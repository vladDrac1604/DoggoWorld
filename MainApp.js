const express = require('express');
const { METHODS } = require('http');
const app = express();
const morgan = require('morgan');
const path = require('path');
const { Pool } = require('pg');
const { serialize } = require('v8');
const bcrypt = require('bcrypt');
const session = require('express-session');
require('dotenv').config();

let pool = new Pool();

//****MIDDLEWARES****

app.use(express.static('StyleSheets'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('dev'));
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');
app.use(session({ secret: '***regularpassword***', resave: false, saveUninitialized: false }));



//*********ROUTES*********

app.get("/home", function (req, res) {
    let m = 0;
    if (!req.session.username) {
        m = 1;
    }
    else {
        m = 0;
    }
    res.render("WebPages/HomePage.ejs", { m });
})


//NEW USER REGISTRATION CODE

app.get("/register", function (req, res) {
    res.render("WebPages/RegisterFrom.ejs");
})

app.post("/register/add", function (req, res) {
    const name = req.body.Name;
    const contact = req.body.Contact;
    const age = parseInt(req.body.Age);
    const user = req.body.Username;
    const password = req.body.Password;
    const nums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const specialchars = ['#', '$', '%', '^', '&', '*', '(', ')', ',', '?', '!'];
    try {
        pool.connect(async function (err, client, release) {
            let resp1 = await client.query(`SELECT username FROM project_user`);
            let k = 0;
            for (let i = 0; i < resp1.rows.length; i++) {
                if (resp1.rows[i].username == user) {
                    k = 1;
                }
            }
            if (k == 1) {
                res.render("WebPages/sameUser.ejs");
            }
            else {
                let f = 0, q = 0;
                for (let i = 0; i < nums.length; i++) {
                    if (parseInt(user[0]) == nums[i]) {
                        f = 1;
                        break;
                    }
                }
                for (let i = 0; i < nums.length; i++) {
                    if (parseInt(password[0]) == nums[i]) {
                        q = 1;
                        break;
                    }
                }
                let x = false;
                for (let i = 0; i < specialchars.length; i++) {
                    x = password.includes(specialchars[i]);
                    if (x == true) {
                        break;
                    }
                }
                if (f == 1) {
                    res.render("errors/FirstCharNumber.ejs");
                }
                else if (q == 1) {
                    res.render("errors/passfirstchar.ejs");
                }
                else if (x == true) {
                    res.render("errors/specialchar.ejs");
                }
                else if (f == 0 && (q == 0 && x == false)) {
                    const hashedpw = await bcrypt.hash(password, 12);
                    let resp = await client.query(`INSERT INTO project_user VALUES('${name}','${contact}',${age},'${user}','${hashedpw}')`);
                    res.render("WebPages/registersuccess.ejs");
                    release();
                }
            }
        })
    }
    catch (err) {
        console.log(err);
    }
})



//BREEDS PAGE CODE

app.get("/breeds", function (req, res) {
    let m = 0;
    if (!req.session.username) {
        m = 1;
    }
    else {
        m = 0;
    }
    res.render("WebPages/breeds.ejs", { m });
})



//LOG IN FOR ADOPTION CODE

app.get("/LogIn", async function (req, res) {
    const purpose = "adoption";
    if (!req.session.username) {
        res.render("WebPages/LogIn.ejs", { purpose });
    }
    else {
        try {
            pool.connect(async function (err, client, release) {
                let resp3 = await client.query(`SELECT fullname,username FROM project_user WHERE username='${req.session.username}'`);
                let i = 0;
                const k = [];
                let fullname = resp3.rows[0].fullname;
                while (resp3.rows[0].fullname[i] != " ") {
                    k.push(resp3.rows[0].fullname[i]);
                    i++;
                }
                let name = k.join("");
                name = name.toUpperCase();

                res.render("WebPages/adoption.ejs", { name, fullname });
            })
        }
        catch (err) {
            console.log(err);
        }
    }
})



app.post("/LogIn", function (req, res) {
    const user = req.body.username;
    const pass = req.body.password;
    try {
        pool.connect(async function (err, client, release) {
            let resp1 = await client.query(`SELECT username FROM project_user`);
            let k = 0;
            for (let i = 0; i < resp1.rows.length; i++) {
                if (resp1.rows[i].username == user) {
                    k = 1;
                }
            }
            if (k == 0) {
                res.render("errors/NoUser.ejs");
            }
            else {
                let resp2 = await client.query(`SELECT passkey FROM project_user WHERE username='${user}'`);
                const validpw = await bcrypt.compare(pass, resp2.rows[0].passkey);
                if (!validpw) {
                    res.render("errors/WrongPass.ejs");
                }
                else {
                    req.session.username = user;
                    let resp3 = await client.query(`SELECT fullname,username FROM project_user WHERE username='${user}'`);
                    let i = 0;
                    const k = [];
                    let fullname = resp3.rows[0].fullname;
                    while (resp3.rows[0].fullname[i] != " ") {
                        k.push(resp3.rows[0].fullname[i]);
                        i++;
                    }
                    let name = k.join("");
                    name = name.toUpperCase();

                    res.render("WebPages/adoption.ejs", { name, fullname });
                }
            }
        })
    }
    catch (err) {
        console.log(err);
    }
})


//LOGGING OUT

app.get("/LogOut", function (req, res) {
    req.session.username = null;
    res.render("WebPages/LogOut.ejs");
})


//ADOPTION CONFIRMED CODE

app.post("/adoption/confirmed", function (req, res) {
    const name = req.body.full;
    const Breed = req.body.Breed;
    const Gender = req.body.Gender;
    const Age = parseInt(req.body.Age);

    try {
        pool.connect(async function (err, client, release) {
            if ((!Breed) || (!Gender) || (!Age)) {
                res.render("errors/MissingEntries.ejs");
            }
            else {
                let resp1 = await client.query(`SELECT quantity FROM dogs WHERE breed='${Breed}' AND gender='${Gender}' AND age=${Age}`);
                if (parseInt(resp1.rows[0].quantity) == 0) {
                    res.render("errors/OutOfStock.ejs");
                }
                else {

                    let q = parseInt(resp1.rows[0].quantity) - 1;
                    let resp2 = await client.query(`UPDATE dogs SET quantity=${q} WHERE breed='${Breed}' AND gender='${Gender}' AND age=${Age}`);
                    let resp3 = await client.query(`SELECT COUNT(purchase_number) as num_purch FROM pets`);
                    if (parseInt(resp3.rows[0].num_purch) == 0) {
                        let x = 1;
                        let resp4 = await client.query(`INSERT INTO pets VALUES(${x},'${name}','${Breed}','${Gender}',${Age})`);
                    }
                    else {
                        let resp5 = await client.query(`SELECT purchase_number FROM pets`);
                        let n = (resp5.rows.length) - 1;
                        let m = parseInt(resp5.rows[n].purchase_number) + 1;
                        let resp6 = await client.query(`INSERT INTO pets VALUES(${m},'${name}','${Breed}','${Gender}',${Age})`)
                    }
                    let k = [];
                    let i = 0;
                    while (name[i] != " ") {
                        k.push(name[i]);
                        i++;
                    }

                    let firstname = k.join("");
                    let tempbreed = Breed.toUpperCase();
                    res.render("WebPages/success.ejs", { firstname, tempbreed, Age, Gender });
                }

            }
        })
    }
    catch (err) {
        console.log(err);
    }

})

//*********************REVIEWS CODE STARTS HERE*********************


//ADDING REVIEWS CODE

app.get("/add/reviews/:breed", function (req, res) {
    const purpose = "reviews";
    let Breed = req.params.breed;
    let user = req.session.username;
    if (!req.session.username) {
        res.render("WebPages/LogIn.ejs", { purpose, Breed });
    }
    else {
        try {
            pool.connect(async function (err, client, release) {
                let resp3 = await client.query(`SELECT fullname,username FROM project_user WHERE username='${req.session.username}'`);
                let i = 0;
                const k = [];
                let fullname = resp3.rows[0].fullname;
                while (resp3.rows[0].fullname[i] != " ") {
                    k.push(resp3.rows[0].fullname[i]);
                    i++;
                }
                let name = k.join("");
                let capname = name.toUpperCase();
                Breed = Breed.toUpperCase();
                res.render("WebPages/AddReview.ejs", { capname, name, fullname, Breed, user });
            })
        }
        catch (err) {
            console.log(err);
        }
    }
})
app.post("/add/reviews/:breed", function (req, res) {
    let Breed = req.params.breed;
    const user = req.body.username;
    const pass = req.body.password;
    try {
        pool.connect(async function (err, client, release) {
            let resp1 = await client.query(`SELECT username FROM project_user`);
            let k = 0;
            for (let i = 0; i < resp1.rows.length; i++) {
                if (resp1.rows[i].username == user) {
                    k = 1;
                }
            }
            if (k == 0) {
                res.render("errorsReviews/nouser.ejs", { Breed });
            }
            else {
                let resp2 = await client.query(`SELECT passkey FROM project_user WHERE username='${user}'`);
                const validpw = await bcrypt.compare(pass, resp2.rows[0].passkey);
                if (!validpw) {
                    res.render("errorsReviews/wrongpass.ejs", { Breed });
                }
                else {
                    req.session.username = user;
                    let resp3 = await client.query(`SELECT fullname,username FROM project_user WHERE username='${user}'`);
                    let i = 0;
                    const k = [];
                    let fullname = resp3.rows[0].fullname;
                    while (resp3.rows[0].fullname[i] != " ") {
                        k.push(resp3.rows[0].fullname[i]);
                        i++;
                    }
                    let name = k.join("");
                    let capname = name.toUpperCase();
                    Breed = Breed.toUpperCase();
                    res.render("WebPages/AddReview.ejs", { capname, name, fullname, Breed, user });
                }
            }
        })
    }
    catch (err) {
        console.log(err);
    }
})

app.post("/review/added/:breed", function (req, res) {
    const ReviewBody = req.body.Review;
    const User = req.body.username;
    let Breed = req.params.breed;
    Breed = Breed.toLowerCase();
    const FirstName = req.body.fname;
    let id;
    if (Breed == 'bulldog') {
        id = 108;
    }
    else if (Breed == 'rottweiler') {
        id = 100;
    }
    else if (Breed == 'german shephard') {
        id = 101;
    }
    else if (Breed == 'mastiff') {
        id = 102;
    }
    else if (Breed == 'labrador retriever') {
        id = 103;
    }
    else if (Breed == 'beagle') {
        id = 104;
    }
    else if (Breed == 'pug') {
        id = 105;
    }
    else if (Breed == 'doberman pinscher') {
        id = 106;
    }
    else if (Breed == 'huskey') {
        id = 107;
    }
    else if (Breed == 'dalmation') {
        id = 109;
    }
    try {
        pool.connect(async function (err, client, release) {
            let resp1 = await client.query(`SELECT COUNT(serialnum) FROM DogReviews`);
            if (parseInt(resp1.rows[0].count) == 0) {
                let one = 1;
                let resp = await client.query(`INSERT INTO DogReviews VALUES(${one},${id},'${User}','${Breed}','${ReviewBody}')`);
            }
            else {
                let tempresp = await client.query(`SELECT serialnum FROM DogReviews`);
                let len = tempresp.rows.length;
                let ser = parseInt(tempresp.rows[len - 1].serialnum) + 1;
                let resp = await client.query(`INSERT INTO DogReviews VALUES(${ser},${id},'${User}','${Breed}','${ReviewBody}')`);
            }
            res.render("WebPages/ReviewAdded.ejs", { FirstName, Breed });
        })
    }
    catch (err) {
        console.log(err);
    }
})



//DISPLAYING REVIEWS

app.get("/view/reviews/:id", function (req, res) {
    let m = 0;
    let LoggedIn = "";
    const x = req.params.id;
    const rev_id = parseInt(x);
    try {
        pool.connect(async function (err, client, release) {
            let resp = await client.query(`SELECT username,review,serialnum FROM DogReviews WHERE review_id=${rev_id}`);
            if (resp.rows.length == 0) {
                res.render("errors/EmptyReview.ejs");
            }
            else {
                let resp2 = await client.query(`SELECT DISTINCT(breed) FROM DogReviews WHERE review_id=${rev_id}`);
                let Breed = resp2.rows[0].breed;
                let CapBreed = Breed.toUpperCase();
                let reviews = [];
                let users = [];
                let serial = [];
                for (let i = 0; i < resp.rows.length; i++) {
                    reviews.push(resp.rows[i].review);
                    users.push(resp.rows[i].username);
                    serial.push(resp.rows[i].serialnum)
                }
                if (!req.session.username) {
                    m = 1;
                    LoggedIn = "null";
                }
                else {
                    m = 0;
                    LoggedIn = req.session.username;
                    LoggedIn = LoggedIn + " ";
                }
                res.render("WebPages/DisplayReviews.ejs", { reviews, users, CapBreed, Breed, serial, m, LoggedIn });
            }
        })
    }
    catch (err) {
        console.log(err);
    }
})


//DELETING REVIEWS

app.post("/review/deleted/:SerialNumber", function (req, res) {
    const serial = parseInt(req.params.SerialNumber);
    try {
        pool.connect(async function (err, client, release) {
            let resp2 = await client.query(`DELETE FROM DogReviews WHERE serialnum=${serial}`);
            res.render("WebPages/ReviewDeleted.ejs");
        })
    }
    catch (err) {
        console.log(err);
    }
})


//*********************REVIEWS CODE ENDS HERE*********************


//UPDATING USER CODE

app.get("/update", function (req, res) {
    const user = req.session.username;
    res.render("WebPages/update.ejs", { user });
})

app.post("/update", function (req, res) {
    const olduser = req.body.OldUsername;
    const number = req.body.Number;
    const newuser = req.body.NewUsername;
    const pass = req.body.Password;
    const nums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const specialchars = ['#', '$', '%', '^', '&', '*', '(', ')', ',', '?', '!'];
    try {
        pool.connect(async function (err, client, release) {
            let resp1 = await client.query(`SELECT username FROM project_user`);
            let k = 0;
            for (let i = 0; i < resp1.rows.length; i++) {
                if (olduser == resp1.rows[i].username) {
                    k = 1;
                }
            }
            if (k == 0) {
                res.render("errors/UpdateError.ejs");
            }
            else {
                let f = 0, q = 0;
                for (let i = 0; i < nums.length; i++) {
                    if (parseInt(newuser[0]) == nums[i]) {
                        f = 1;
                        break;
                    }
                }
                for (let i = 0; i < nums.length; i++) {
                    if (parseInt(pass[0]) == nums[i]) {
                        q = 1;
                        break;
                    }
                }
                let x = false;
                for (let i = 0; i < specialchars.length; i++) {
                    x = pass.includes(specialchars[i]);
                    if (x == true) {
                        break;
                    }
                }
                if (f == 1) {
                    res.render("updaterrors/firstcharnuminuser.ejs");
                }
                else if (q == 1) {
                    res.render("updaterrors/pfirstcharnuminpassword.ejs");
                }
                else if (x == true) {
                    res.render("updaterrors/specialcharinpassword.ejs");
                }

                else if (f == 0 && (q == 0 && x == false)) {
                    const hashedpw = await bcrypt.hash(pass, 12);
                    let resp2 = await client.query(`UPDATE project_user SET contact='${number}',username='${newuser}',passkey='${hashedpw}' WHERE username='${olduser}'`);
                    res.render("WebPages/updatesuccess.ejs");
                }
            }
        })
    }
    catch (err) {
        console.log(err);
    }
})

//NUTRIENTS PAGE CODE

app.get("/nutrients", function (req, res) {
    res.render("WebPages/nutri.ejs");
})
app.post("/nutrients", function (req, res) {
    const breed = req.body.Breed;
    let m;
    if (req.session.username) {
        m = 0;
    }
    else {
        m = 1;
    }
    if (breed == 'rottweiler') {
        res.render("nutrients/rott.ejs", { m });
    }
    else if (breed == 'pug') {
        res.render("nutrients/pug.ejs", { m });
    }
    else if (breed == 'huskey') {
        res.render("nutrients/huskey.ejs", { m });
    }
    else if (breed == 'labrador retriever') {
        res.render("nutrients/lebra.ejs", { m });
    }
    else if (breed == 'doberman pinscher') {
        res.render("nutrients/doberman.ejs", { m });
    }
    else if (breed == 'bulldog') {
        res.render("nutrients/bulldog.ejs", { m });
    }
    else if (breed == 'dalmation') {
        res.render("nutrients/dal.ejs", { m });
    }
    else if (breed == 'beagle') {
        res.render("nutrients/beagle.ejs", { m });
    }
    else if (breed == 'mastiff') {
        res.render("nutrients/mastiff.ejs", { m });
    }
    else if (breed == 'german shephard') {
        res.render("nutrients/shephard.ejs", { m });
    }
})

//ASSESSMENT PAGE CODE

app.get("/assessment", function (req, res) {
    res.render("WebPages/assessment.ejs");
})

app.post("/assessment", function (req, res) {
    const Breed = req.body.Breed;
    const Age = req.body.Age;
    const Weight = parseInt(req.body.Weight);
    try {
        pool.connect(async function (err, client, release) {
            if ((!Age) || (!Breed) || (!Weight)) {
                res.render("errors/MissingEntriesInAssessment.ejs");
            }
            else {
                let resp1 = await client.query(`SELECT min_weight,max_weight FROM assessment WHERE breed='${Breed}' AND age='${Age}'`);
                if (Weight < resp1.rows[0].min_weight) {
                    res.render("assessment/lowweight.ejs", { Breed });
                }
                else if (Weight > resp1.rows[0].max_weight) {
                    res.render("assessment/highweight.ejs", { Breed });
                }
                else {
                    res.render("assessment/healthy.ejs", { Breed });
                }
            }
        })
    }

    catch (err) {
        console.log(err);
    }
})



//DISEASES CODE

app.get("/heartworm", function (req, res) {
    let m;
    if (req.session.username) {
        m = 0;
    }
    else {
        m = 1;
    }
    res.render("diseases/heartworm.ejs", { m });
})
app.get("/leptospirosis", function (req, res) {
    let m;
    if (req.session.username) {
        m = 0;
    }
    else {
        m = 1;
    }
    res.render("diseases/leptospirosis.ejs", { m });
})
app.get("/lyme", function (req, res) {
    let m;
    if (req.session.username) {
        m = 0;
    }
    else {
        m = 1;
    }
    res.render("diseases/lyme.ejs", { m });
})
app.get("/canine", function (req, res) {
    let m;
    if (req.session.username) {
        m = 0;
    }
    else {
        m = 1;
    }
    res.render("diseases/canine.ejs", { m });
})
app.get("/kennel", function (req, res) {
    let m;
    if (req.session.username) {
        m = 0;
    }
    else {
        m = 1;
    }
    res.render("diseases/kennel.ejs", { m });
})


// ADOPTION GUIDE CODE

app.get("/AdoptionGuide", function (req, res) {
    res.render("WebPages/guide.ejs");
})
app.post("/AdoptionGuide", function (req, res) {
    let arr = [];
    if (req.body.friend && req.body.healththerapy && !req.body.security && !req.body.workout && !req.body.labour) {
        arr.push('labrador retriever');
        arr.push('pug');
        arr.push('huskey');
        arr.push('beagle');
    }
    else if (!req.body.friend && req.body.healththerapy && !req.body.security && !req.body.workout && !req.body.labour) {
        arr.push('labrador retriever');
        arr.push('huskey');
    }
    else if (req.body.friend && !req.body.healththerapy && !req.body.security && req.body.workout && !req.body.labour) {
        arr.push('german shephard');
        arr.push('dalmation');
        arr.push('doberman pinscher');
        arr.push('rottweiler');
        arr.push('huskey');
    }
    else if (req.body.friend && !req.body.healththerapy && !req.body.security && !req.body.workout && !req.body.labour) {
        arr.push('labrador retriever');
        arr.push('huskey');
        arr.push('pug');
        arr.push('beagle');
    }
    else if (req.body.friend && req.body.healththerapy && req.body.security && !req.body.workout && !req.body.labour) {
        arr.push('labrador retriever');
        arr.push('huskey');
        arr.push('rottweiler');
        arr.push('doberman pinscher');
        arr.push('bulldog');
    }
    else if (!req.body.friend && req.body.healththerapy && req.body.security && !req.body.workout && !req.body.labour) {
        arr.push('huskey');
        arr.push('rottweiler');
        arr.push('labrador');
    }
    else if (!req.body.friend && !req.body.healththerapy && req.body.security && !req.body.workout && !req.body.labour) {
        arr.push('doberman pinscher');
        arr.push('rottweiler');
        arr.push('bulldog');
        arr.push('huskey');
        arr.push('dalmation');
    }
    else if (!req.body.friend && !req.body.healththerapy && req.body.security && req.body.workout && !req.body.labour) {
        arr.push('doberman pinscher');
        arr.push('rottweiler');
        arr.push('huskey');
        arr.push('dalmation');
    }
    else if (!req.body.friend && !req.body.healththerapy && !req.body.security && req.body.workout && !req.body.labour) {
        arr.push('doberman pinscher');
        arr.push('rottweiler');
        arr.push('dalmation');
        arr.push('german shephard');
    }
    else if (!req.body.friend && !req.body.healththerapy && !req.body.security && !req.body.workout && req.body.labour) {
        arr.push('mastiff');
        arr.push('bulldog');
        arr.push('german shephard');
    }
    else if (!req.body.friend && !req.body.healththerapy && req.body.security && !req.body.workout && req.body.labour) {
        arr.push('mastiff');
        arr.push('rottweiler');
        arr.push('bulldog');
    }
    else if (!req.body.friend && !req.body.healththerapy && !req.body.security && req.body.workout && req.body.labour) {
        arr.push('dalmation');
        arr.push('german shephard');
        arr.push('rottweiler');
    }
    else if (req.body.friend && !req.body.healththerapy && !req.body.security && !req.body.workout && req.body.labour) {
        arr.push('mastiff');
        arr.push('labrador retriever');
        arr.push('german shephard');
    }
    else if (req.body.friend && req.body.healththerapy && !req.body.security && !req.body.workout && req.body.labour) {
        arr.push('mastiff');
        arr.push('bulldog');
        arr.push('labrador retriever');
    }
    else if (!req.body.friend && req.body.healththerapy && !req.body.security && !req.body.workout && req.body.labour) {
        arr.push('mastiff');
        arr.push('labrador retriever');
    }
    else if (req.body.friend && req.body.healththerapy && req.body.security && req.body.workout && req.body.labour) {
        arr.push('doberman pinscher');
        arr.push('huskey');
        arr.push('rottweiler');
        arr.push('mastiff');
        arr.push('dalmation');
        arr.push('german shephard');
    }
    else if (!req.body.friend && req.body.healththerapy && !req.body.security && req.body.workout && !req.body.labour) {
        arr.push('bulldog');
        arr.push('labrador retriever');
        arr.push('dalmation');
        arr.push('beagle');
    }
    else if (req.body.friend && !req.body.healththerapy && req.body.security && !req.body.workout && !req.body.labour) {
        arr.push('labrador');
        arr.push('huskey');
        arr.push('rottweiler');
        arr.push('bulldog');
    }
    else if (!req.body.friend && !req.body.healththerapy && req.body.security && req.body.workout && req.body.labour) {
        arr.push('german shephard');
        arr.push('mastiff');
        arr.push('dalmation');
        arr.push('rottweiler');
        arr.push('bulldog');
    }
    else if (!req.body.friend && req.body.healththerapy && req.body.security && req.body.workout && !req.body.labour) {
        arr.push('doberman pinscher');
        arr.push('huskey');
        arr.push('german shephard');
        arr.push('dalmation');
        arr.push('rottweiler');
        arr.push('bulldog');
    }
    else if (req.body.friend && !req.body.healththerapy && req.body.security && req.body.workout && req.body.labour) {
        arr.push('doberman pinscher');
        arr.push('dalmation');
        arr.push('rottweiler');
        arr.push('bulldog');
        arr.push('mastiff');
    }
    else if (req.body.friend && req.body.healththerapy && !req.body.security && req.body.workout && !req.body.labour) {
        arr.push('huskey');
        arr.push('beagle');
        arr.push('dalmation');
        arr.push('german shephard');
    }
    else if (req.body.friend && !req.body.healththerapy && req.body.security && req.body.workout && !req.body.labour) {
        arr.push('huskey');
        arr.push('doberman pinscher');
        arr.push('rottweiler');
        arr.push('german shephard');
    }
    else if (req.body.friend && req.body.healththerapy && req.body.security && req.body.workout && !req.body.labour) {
        arr.push('huskey');
        arr.push('labrador retriever');
        arr.push('doberman pinscher');
        arr.push('rottweiler');
        arr.push('dalmation');
        arr.push('german shephard');
    }
    else if (req.body.friend && req.body.healththerapy && req.body.security && !req.body.workout && req.body.labour) {
        arr.push('huskey');
        arr.push('doberman pinscher');
        arr.push('rottweiler');
        arr.push('mastiff');
        arr.push('german shephard');
    }
    else if (!req.body.friend && req.body.healththerapy && req.body.security && req.body.workout && req.body.labour) {
        arr.push('huskey');
        arr.push('dalmation');
        arr.push('doberman pinscher');
        arr.push('rottweiler');
        arr.push('mastiff');
        arr.push('german shephard');
    }
    else if (req.body.friend && !req.body.healththerapy && req.body.security && !req.body.workout && req.body.labour) {
        arr.push('huskey');
        arr.push('doberman pinscher');
        arr.push('bulldog');
        arr.push('mastiff');
        arr.push('german shephard');
    }
    else if (!req.body.friend && req.body.healththerapy && req.body.security && !req.body.workout && req.body.labour) {
        arr.push('huskey');
        arr.push('doberman pinscher');
        arr.push('bulldog');
        arr.push('mastiff');
        arr.push('german shephard');
    }

    if (arr.length >= 1) {
        res.render('WebPages/advice.ejs', { arr });
    }
    else if (arr.length == 0) {
        res.render("WebPages/notselected.ejs");
    }
})


const port = process.env.PORT;
app.listen(port, function (req, res) {
    console.log("Local server created");
})
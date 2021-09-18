const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const clientModel = require('../Models/client');
const {hashPassword} = require('../Utils/hash');
const {sendEmail} = require('../Utils/sendmail');
const {isNotAuthenticated} = require('../Middlewares/auth');

router.get('/verify/:token', isNotAuthenticated, (req, res, next) => {
    let token = req.params.token;
    jwt.verify(token, process.env.JWT_SECRECT, (err, client) => {
        if(err) {
            console.error(err);
            req.flash('error_msg', 'Your token has expired');
            return res.redirect('/clientRegister');
        }
        let user = new clientModel(client);
        user.isVerified = true;
        user.save() 
            .then(client => {
                let mailOptions = {
                    from: 'LawHub',
                    to: req.body.email,
                    subject: 'Verified your email',
                    html: `
                    <p>Your email is verified. Thank you for registering to LawHub</p>
                    `
                };
                sendEmail(mailOptions);
                req.flash('success_msg', 'Successfully registered. Please login');
                return res.redirect('/clientLogin');
            })
            .catch(err => {
                console.error(err);
                next(createError('Something went wrong'));
            }); 
    });
});

router.post('/register', isNotAuthenticated, (req, res, next) => {
    try {
        let {email, password, cpassword} = req.body;
        if(password!==cpassword) {
            req.flash('error_msg','Passwords are not matching');
            return res.redirect('/clientRegister');
        }
        clientModel.findOne({email})
            .then(client => {
                if(client) {
                    req.flash('error_msg','This email already exists');
                    return res.redirect('/register');
                } else {
                    req.body.password = hashPassword(req.body.password);
                    let user = {
                        username: req.body.username,
                        email: req.body.email,
                        password: req.body.password
                    };
                    let token = jwt.sign(user, process.env.JWT_SECRECT, {expiresIn: '15m'});
                    let mailOptions = {
                        from: 'LawHub',
                        to: req.body.email,
                        subject: 'Verification email from LawHub',
                        html: `
                        <p>This token is valid upto 15 mins. Quickly verify your email before expiry.</p>
                        <p>To verify your email <a href='${process.env.URL}/users/verify/${token}'>click here</a></p>
                        `
                    };
                    sendEmail(mailOptions);
                    req.flash('info_msg', 'Check your mail and verify with us');
                    return res.redirect('/clientLogin');
                }
            })
            .catch(err => {
                console.error(err);
                next(createError('Something went wrong'));
            });
    } catch(err) {
        console.error(err);
        next(createError(err));
    }
});

router.post('/login', isNotAuthenticated, (req, res, next) => {
    let {email, password, checkbox} = req.body;
    clientModel.findOne({email})
        .then(client => {
            if(!client) {
                req.flash('error_msg', 'User not exists');
                return res.redirect('/clientLogin');
            }
            bcrypt.compare(password, client.password)
                .then(ok => {
                    if(ok) {
                        if(checkbox == 'on') process.env.SESSION_MAX_AGE = 43200000;
                        req.session.client = client;
                        req.flash('success_msg', 'Successfully loggedIn');
                        return res.redirect('/');
                    } else {
                        req.flash('error_msg', 'Incorrect password');
                        return res.redirect('/clientLogin');
                    }
                })
                .catch(err => {
                    console.error(err);
                    next(createError('Something went wrong'));
                });
        })
        .catch(err => {
            console.error(err);
            next(createError('Something went wrong'));
        });
});

module.exports = router;
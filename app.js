require('dotenv').config();

const bodyParser    = require('body-parser');
const cookieParser  = require('cookie-parser');
const express       = require('express');
const favicon       = require('serve-favicon');
const hbs           = require('hbs');
const mongoose      = require('mongoose');
const logger        = require('morgan');
const path          = require('path');

//For Users
const User          = require('./models/User');
const session       = require("express-session");

const bcrypt        = require("bcryptjs");
const passport      = require("passport");
const LocalStrategy = require("passport-local").Strategy;

//For flash message
const flash = require("connect-flash");

//For Google Auth
const GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;




mongoose
  .connect('mongodb://localhost/tins-list', {useNewUrlParser: true})
  .then(x => {
    console.log(`Connected to Mongo! Database name: "${x.connections[0].name}"`)
  })
  .catch(err => {
    console.error('Error connecting to mongo', err)
  });

const app_name = require('./package.json').name;
const debug = require('debug')(`${app_name}:${path.basename(__filename).split('.')[0]}`);

const app = express();

// Middleware Setup
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Express View engine setup

app.use(require('node-sass-middleware')({
  src:  path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public'),
  sourceMap: true
}));
      

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));



// default value for title local
app.locals.title = 'Express - Generated with IronGenerator';



// /*Session Stuff*/
// app.use(session({
//   secret: "Shhhh",
//   cookie: { maxAge: 60000 },
//   store: new MongoStore({
//     mongooseConnection: mongoose.connection,
//     ttl: 24 * 60 * 60 
//   })
// }));
//using the lines below rather than above.
app.use(session({
  secret: "Shhhh",
  resave: true,
  saveUninitialized: true
}));


//Passport stuff
passport.serializeUser((user, cb) => {
  cb(null, user._id);
});
passport.deserializeUser((id, cb) => {
  User.findById(id, (err, user) => {
    if (err) { return cb(err); }
    cb(null, user);
  });
});

//For flash messages
app.use(flash());

//Passport stuff
// with passport you dont get to choose it looks for req.body.username 
// and req.body.password
// choose your name="" in the hbs file accordingly
passport.use(new LocalStrategy((username, password, next) => {
  User.findOne({ username }, (err, user) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return next(null, false, { message: "Sorry we couldn't find that username" });
    }
    if (!bcrypt.compareSync(password, user.password)) {
      return next(null, false, { message: "Password not correct for that username" });
    }
    return next(null, user);
  });
}));

//For Google Auth
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLEID,
  clientSecret: process.env.GOOGLESECRET,
  callbackURL: "/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  console.log(profile);
  User.findOne({ googleID: profile.id })
  .then(user => {
    console.log("Before if statement")

    if (user) {
      console.log("I GOT HERE")
      return done(null, user);
    } else{
      // this else means we did not find a user with this googleID 
      console.log("NO I AM NOT, I AM HERE ACTUALLY");
      User.findOne({email: profile._json.email})
      .then((userWithThatName)=>{

        if(userWithThatName){
          userWithThatName.googleID = profile.id
          userWithThatName.save()
          .then((updatedUser)=>{
            done(null, updatedUser)
          })
          .catch((err)=>{
            next(err);
          })

        } else {
          // this else means theres nobody with that google id or with that name

          const newUser = new User({
            googleID: profile.id,
            email: profile._json.email
          });

          newUser.save()
          .then(user => {
            done(null, newUser);
          })
          .catch(error => {
            next(error)
          })

        }

      })
      .catch((err)=>{
        next(err);
      })

    }

  })
  .catch(error => {
    next(error)
  })

}));


//
app.use(passport.initialize());
app.use(passport.session());



app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.msg         = req.flash('error')
  next();
});



//Routes
const index = require('./routes/index');
app.use('/', index);

const userRoutes = require('./routes/user-routes');
app.use('/', userRoutes);

const listingRoutes = require('./routes/listing-routes');
app.use('/', listingRoutes)


module.exports = app;

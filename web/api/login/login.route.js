import express from 'express';
import passport from 'passport';
import crypto from 'crypto';
import { Strategy } from 'passport-local';
import uid from 'uid';
import { typeCheck } from 'type-check';
import User, { emailRegex } from '../user/user.model';
import { createTransport } from 'nodemailer';

const API_URL = process.env.NODE_ENV === 'production'
	? 'https://largeproject.herokuapp.com/api'
	: 'http://localhost:8000/api';

// email auth
const sender_user = process.env.EMAIL_USER || "stool.4.u@outlook.com";
const sender_pass = process.env.EMAIL_PASSWORD || "8QvGzYY2HDeZ2uw";
const emailTransporter = createTransport({
	service: 'outlook',
	auth: {
		user: sender_user, 
		pass: sender_pass 
	}
});

const loginRouter = express.Router();

// Hashes password with salt 1000 times using sha512
function generatePasswordWithSalt(user, givenPassword) {
	return crypto.pbkdf2Sync(givenPassword, user._id.toString(), 1000, 64, 'sha512').toString('hex');
}

function validatePassword(user, givenPassword) {
	const hashedPassword = generatePasswordWithSalt(user, givenPassword);
	return user.password === hashedPassword;
}

function logIn(username, password, done) {
	User.findOne({ $or: [{ username }, { email: username }] }, (err, user) => {
		if (err) {
			return done(err);
		}
		if (!user || !validatePassword(user, password)) {
			return done(null, false, { message: 'Incorrect username/password '});
		}

		return done(null, user);
	});
}

passport.use(new Strategy(logIn));

// Allows Passport to let express-session link session to ID
passport.serializeUser((user, done) => {
	done(null, user._id)
});

// Allows Passport to grab a user based on ID
passport.deserializeUser((id, done) => {
	User.findById(id, (err, user) => {
		done(err, user);
	});
})

// Main login route
loginRouter.post('/login',
	passport.authenticate('local'),
	(req, res) => {
		res.json(req.user.toObject());
	}
);

// Logout a user
loginRouter.post('/logout', (req, res) => {
	req.logout();
	console.log('logging out');
	req.session.destroy((err) => {
		if (err) {
			return res.status(500).send(err);
		}
		res.send('successfully logged out');
	});
});

async function isUserDuplicate(username, email) {
	const usernameUser = await User.exists({ username });
	const emailUser = await User.exists({ email });

	return { isUsername: usernameUser, isEmail: emailUser };
}

loginRouter.post('/register', (req, res) => {
	const {
		username,
		password,
		email,
		firstName,
		lastName,
	} = req.body;

	if (!typeCheck('{username: String, password: String, email: String}', { username, password, email })) {
		return res.status(400).send('Invalid request parameters');
	}

	isUserDuplicate().then(({ isUsername, isEmail }) => {
		if (isUsername) {
			return res.status(403).json({ err: 'Username already exists' });
		}
		if (!emailRegex.test(email)) {
			return res.status(400).json({ err: 'Malformed email syntax' });
		}
		if (isEmail) {
			return res.status(403).json({ err: 'Email already exists' });
		}

		const user = new User({
			firstName,
			lastName,
			username,
			email,
			verificationToken: uid(16),
		});
		user.password = generatePasswordWithSalt(user, password);
		user.verificationToken = uid(16);
		user.save().then((savedUser) => {
			sendRegistrationEmail(savedUser);
			res.json(savedUser.toObject());
		}).catch(err => res.status(500).send(err));
	})
});

async function sendRegistrationEmail(user) {
	// set token for this user
	var token = user.verificationToken;

	// authentication email
	var mailOptions = {
		from: sender_user,
		to: user.email,
		subject: 'verification email',
		html: `You have registered for Brist-Tool. <a href="${API_URL}/auth/verify_token?token=${encodeURI(token)}">Click here</a> to complete the registration, or enter this code:<br><b>${token}</b>`
	};

	// send email and handle results
	emailTransporter.sendMail(mailOptions, function(error,info){
		if (error){
			console.log(error)
		} else {
			console.log('Email sent: ' + info.response);
		}
	});
}

// given the token, verify the user
loginRouter.get('/verify_token', (req, res) => {
	// assumming this is how the user is sending us their token
	const { token } = req.query;

	User.findOne({ verificationToken: token }, (err, user) => {
		if (err) {
			return res.status(500).send(err);
		} else if (user) {
			user.verificationToken = null;
			user.verified = true;
			user.save().then(() => {
				res.redirect('/');
			}).catch(e => res.status(500).send('error'));
		} else {
			res.status(401).send('Unauthorized');
		}
	});
});

// recreate and resend user's token
loginRouter.post('/retoken', (req, res) => {
	if (req.isAuthenticated()) {
		// if user is already verified, exit
		if (!req.user.verified) {
			// create and save new token
			req.user.verification_token = uid(16);
			req.user.save().then((savedUser) => {
				sendRegistrationEmail(savedUser);
				res.status(200).send('success');
			}).catch(err => res.status(500).send(err));
		} else {
			res.status(200).send('already verified');
		}
	} else {
		res.status(401).send('not logged in');
	}
});

export default loginRouter;
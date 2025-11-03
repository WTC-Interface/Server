import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3001;

// --- MongoDB Setup ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// --- Country Schema ---
const countrySchema = new mongoose.Schema({
  userId: String,
  username: String,
  funding: Number,
  companies: Number,
  speechEvents: Number,
  elections: Number,
  healthcare: Number,
  education: Number,
  policeCrime: Number,
  environment: Number,
  infrastructure: Number
});

const Country = mongoose.model("Country", countrySchema);

// --- Middleware ---
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// --- Passport Discord OAuth ---
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  // Find user country data
  const country = await Country.findOne({ userId: id });
  done(null, country || { id });
});

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ["identify"]
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let country = await Country.findOne({ userId: profile.id });
    if (!country) {
      // Create default country
      country = await Country.create({
        userId: profile.id,
        username: profile.username,
        funding: 1000,
        companies: 5,
        speechEvents: 0,
        elections: 0,
        healthcare: 50,
        education: 50,
        policeCrime: 50,
        environment: 50,
        infrastructure: 50
      });
    }
    return done(null, country);
  } catch (err) {
    console.error(err);
    return done(err, null);
  }
}));

// --- Routes ---
app.get("/", (req, res) => res.send("Backend running"));

app.get("/api/auth/discord", passport.authenticate("discord"));

app.get("/api/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  (req, res) => {
    // Redirect to frontend after login
    res.redirect("http://localhost:3000");
  }
);

app.get("/api/auth/check", (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });
  res.json({ user: { id: req.user.userId, username: req.user.username }, country: req.user });
});

// Example update route (optional)
app.post("/api/country/:field/:amount", express.json(), async (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });

  const { field, amount } = req.params;
  const update = { [field]: Number(amount) };
  await Country.updateOne({ userId: req.user.userId }, update);
  const updatedCountry = await Country.findOne({ userId: req.user.userId });
  res.json(updatedCountry);
});

// --- Start Server ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

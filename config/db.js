const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

let isConnected = false;

async function connectDB() {
	if (isConnected) {
		return;
	}

	const mongoUri = process.env.MONGODB_URI;

	if (!mongoUri) {
		throw new Error("MONGODB_URI is not set in environment variables.");
	}

	await mongoose.connect(mongoUri);
	isConnected = true;
	console.log("MongoDB connected successfully");
}

module.exports = connectDB;

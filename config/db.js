const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

let connectionPromise = null;

async function connectDB() {
	const mongoUri = process.env.MONGODB_URI;

	if (!mongoUri) {
		throw new Error("MONGODB_URI is not set in environment variables.");
	}

	if (mongoose.connection.readyState === 1) {
		return mongoose.connection;
	}

	if (connectionPromise) {
		await connectionPromise;
		return mongoose.connection;
	}

	connectionPromise = mongoose
		.connect(mongoUri, {
			serverSelectionTimeoutMS: 10000,
			maxPoolSize: 10
		})
		.then((conn) => {
			console.log("MongoDB connected successfully");
			return conn;
		})
		.catch((error) => {
			connectionPromise = null;
			throw error;
		});

	await connectionPromise;
	return mongoose.connection;
}

module.exports = connectDB;

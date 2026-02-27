const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
	{
		roll: {
			type: String,
			required: true,
			unique: true,
			trim: true
		},
		name: {
			type: String,
			required: true,
			trim: true
		},
		class: {
			type: String,
			required: true,
			trim: true
		},
		attendance: {
			type: Number,
			required: true,
			min: 0,
			max: 100
		},
		phone: {
			type: String,
			required: true,
			trim: true
		}
	},
	{
		timestamps: true
	}
);

module.exports = mongoose.model("Student", studentSchema);

const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
	{
		employeeId: {
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
		subject: {
			type: String,
			required: true,
			trim: true
		},
		classes: {
			type: Number,
			required: true,
			min: 0
		},
		experience: {
			type: Number,
			required: true,
			min: 0
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

module.exports = mongoose.model("Teacher", teacherSchema);

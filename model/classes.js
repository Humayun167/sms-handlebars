const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
    {
        className: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        grade: {
            type: String,
            required: true,
            trim: true
        },
        room: {
            type: String,
            required: true,
            trim: true
        },
        classTeacher: {
            type: String,
            required: true,
            trim: true
        },
        capacity: {
            type: Number,
            required: true,
            min: 1
        },
        enrolled: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Class", classSchema);

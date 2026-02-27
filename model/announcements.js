const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            required: true,
            trim: true
        },
        audience: {
            type: String,
            required: true,
            trim: true
        },
        date: {
            type: String,
            required: true,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Announcement", announcementSchema);

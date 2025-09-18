const mongoose = require('mongoose')

const usersSchema = new mongoose.Schema({
    username: String,
    email: String,
    gender: String,
    password: String,
    profilePic: String,
    documents: [String]
})

module.exports = mongoose.model('User', usersSchema)
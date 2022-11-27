const {prompt} = require('inquirer')
const chalk = require("chalk")

const cHighlight = chalk.bold.yellowBright;

module.exports = {
    actions: ["Refresh Access Keys", "Reset Password"],

    getStarted: async function(profiles){
        const questions = [
            {
                name: "action",
                type: "list",
                message: "What would you like to do?",
                choices: this.actions,
                default: 0
            },
            {
                name: "profile",
                type: "list",
                message: "Choose an AWS Profile:",
                choices: Object.keys(profiles),
                default: 0
            }
        ]

        return await prompt(questions)
    },

    confirmActOnProfile: async function(action, accountInfo){
        const questions = [
            {
                name: "confirmActOnProfile",
                type: "confirm",
                message: `Confirm ${cHighlight(action)} on the following IAM User: '${cHighlight(accountInfo)}', there is no Undo.`,
                default: false
            }
        ]
        return await prompt(questions)
    },

    confirmDeleteAccessKey: async function(accessKeyObj){
        const questions = [
            {
                name: "confirmDeleteAccessKey",
                type: "confirm",
                message: `${cHighlight("DELETE")} the following AccessKey ID: '${cHighlight(accessKeyObj.AccessKeyId)}', Status: '${cHighlight(accessKeyObj.Status)}', there is no Undo.`,
                default: false
            }
        ]
        return await prompt(questions)
    },

    passwordChange: async function(accountInfo){
        const questions = [
            {
                name: "oldPassword",
                type: "input",
                message: `Please enter your old password for '${cHighlight(accountInfo)}'.`
            }
        ]
        return await prompt(questions)
    }
}
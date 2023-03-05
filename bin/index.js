const awsTools = require('../lib/AwsTools');
require('aws-sdk/lib/maintenance_mode_message').suppress = true;
const chalk = require('chalk');
const clear = require('clear');
const prerequisites = require('../lib/prerequisites');
const prompts = require('../lib/prompts');

const dependencies = ['aws'];
const appName = "AWS IAM Credentials Manager";
const debugAws = require('debug')('aws-sdk');

const cTitle = chalk.hex('#DF732D').bold;
const cSuccess = chalk.bold.greenBright;
const cWarn = chalk.bold.yellow;
const cError = chalk.bold.redBright;
const cHighlight = chalk.bold.cyanBright;

const tools = new awsTools();

try {
    (async () => {
        clear();
        console.log(cTitle(appName));
        console.log(cTitle('–––––––––––––––––––––'));
        prerequisites.checkBinaries(dependencies);

        //Prompt for modifying Access Keys or Password (TBD)
        //Gather and prompt for the profile to modify
        const awsProfiles = awsTools.fetchProfiles();
        if (typeof awsProfiles === "undefined") {
            throw new Error("Please make sure your AWS CLI is configured with a Profile.\nhttps://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html");
        }

        const getStartedAnswers = await prompts.getStarted(awsProfiles);
        const action = getStartedAnswers.action;
        const actingProfileName = getStartedAnswers.profile;
        const actingAwsUtils = new awsTools(actingProfileName);
        const actionProfileIdentity = await actingAwsUtils.fetchCallerIdentity();
        const actionUserName = actingAwsUtils.getUserNameFromArn(actionProfileIdentity.Arn);
        const confirmation = await prompts.confirmActOnProfile(action, actionProfileIdentity.Arn);

        if (confirmation.confirmActOnProfile) {
            let accessKeyTrash, newKey, oldPassword, newPassword
            switch (action) {
                // Keys
                case prompts.actions[0] :
                    //Get existing keys for the given profile
                    accessKeyTrash = await actingAwsUtils.keysNeedCleanup()
                    //Remove Disabled, Create New, and Disable Old Keys
                    if (accessKeyTrash) {
                        const promptDeleteKey = await prompts.confirmDeleteAccessKey(accessKeyTrash)
                        if (promptDeleteKey.confirmDeleteAccessKey) {
                            await actingAwsUtils.deleteAccessKey(accessKeyTrash.AccessKeyId, accessKeyTrash.UserName)
                            console.log(cSuccess(`DELETED ${accessKeyTrash.AccessKeyId}`))
                        } else {
                            console.log(cWarn(`You will need to manually update your keys at ${await actingAwsUtils.createAwsConsoleLink()} .`))
                        }
                    }
                    //Create & Write new Keys to .aws/credentials
                    newKey = await actingAwsUtils.createAwsAccessKey(actionUserName, true)
                    console.log(cSuccess(newKey.AccessKey))
                    break
                // Passwords
                case prompts.actions[1] :
                    oldPassword = (await prompts.passwordChange(actionUserName)).oldPassword
                    newPassword = await actingAwsUtils.changePassword(oldPassword)
                    console.log(cSuccess(`Your new password is: ${cHighlight(newPassword)}\nPlease make note of this before closing this window.`))
                    break
                default:
                    console.log(cWarn("Please choose an action."))
                    break
            }
        } else {
            process.exit(0)
        }
    })()
} catch (err) {
    console.error(cError(err.message))
    process.exit(1)
}
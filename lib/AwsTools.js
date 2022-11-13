const AWS = require('aws-sdk');
const fs = require("fs")
const genPass = require("generate-password")
const ini = require("ini")

const AWS_HOME_DIR = '.aws/credentials';
const AWS_MAX_ACCESS_KEYS = 2;

class AwsTools {
    constructor(profileName=""){
        profileName = (profileName.toString()).trim();
        this.accessKeysMax = AWS_MAX_ACCESS_KEYS;
        this.credentialsPath = process.env.AWS_SHARED_CREDENTIALS_FILE || `${process.env.HOME}/${AWS_HOME_DIR}`;
        this.profileName = profileName.length > 0 ? profileName : defaultProfileName;
        this.credentials = new AWS.SharedIniFileCredentials({profile: this.profileName});
        AWS.config.credentials = this.credentials;
        this.awsIniCredentials = this.fetchProfiles(this.profileName);
    }

    /**
     * Fetches, and returns AWS IAM Access Keys for a particular User.
     * @param {string} userName
     * @return {Promise<IAM.AccessKeyMetadata[]>}
     * @private
     */
    async _fetchAccessKeys(userName){
        const iam = new AWS.IAM()
        const keys = await iam.listAccessKeys({UserName: userName}).promise()
        return keys.AccessKeyMetadata
    }

    /**
     * Fetches the Password Policy from AWS, and returns specific properties.
     * @return {Promise<{MinimumPasswordLength: *, RequireLowercaseCharacters: *, RequireNumbers: *, RequireUppercaseCharacters: *, RequireSymbols: *}>}
     * @private
     */
    async _fetchPasswordRules(){
        const iam = new AWS.IAM()
        const rules = await iam.getAccountPasswordPolicy({}).promise()
        return {
            MinimumPasswordLength: rules.PasswordPolicy.MinimumPasswordLength,
            RequireLowercaseCharacters: rules.PasswordPolicy.RequireLowercaseCharacters,
            RequireNumbers: rules.PasswordPolicy.RequireNumbers,
            RequireSymbols: rules.PasswordPolicy.RequireSymbols,
            RequireUppercaseCharacters: rules.PasswordPolicy.RequireUppercaseCharacters
        }
    }

    /**
     * Checks if we already have the maximum number of Access Keys in IAM.
     * @param {Array} keys
     * @return {boolean}
     */
    accessKeysFull(keys){
        return keys.length >= this.accessKeysMax
    }

    /**
     * Creates a new, and then changes, an AWS IAM password, following the established AWS Account Password Policy.
     * @param {string} oldPassword
     * @return {Promise<string>}
     */
    async changePassword(oldPassword) {
        const iam = new AWS.IAM()
        const rules = await this._fetchPasswordRules()
        const awsSymbols = "!@#$%^&*()_+-=[]{}|'"
        const pwLength = Math.floor(Math.random() * ((rules.MinimumPasswordLength + 10) - rules.MinimumPasswordLength) + rules.MinimumPasswordLength)
        const newPassword = genPass.generate({
            length: pwLength,
            numbers: rules.RequireNumbers,
            symbols: rules.RequireSymbols ? awsSymbols : false,
            uppercase: rules.RequireUppercaseCharacters,
            lowercase: rules.RequireLowercaseCharacters,
            strict: true
        })
        await iam.changePassword({
            OldPassword: oldPassword,
            NewPassword: newPassword
        }).promise()
        return newPassword
    }

    /**
     * Creates a new IAM AccessKey and optionally saves it to the local ~/.aws/credentials file, after making a backup.
     * @param {string} userName AWS IAM Username associated with the key
     * @param {boolean} save Whether to save the new key & secret key to any local profiles that use it
     * @return {Promise<IAM.CreateAccessKeyResponse & {$response: Response<IAM.CreateAccessKeyResponse, Error & {code: string, message: string, retryable?: boolean, statusCode?: number, time: Date, hostname?: string, region?: string, retryDelay?: number, requestId?: string, extendedRequestId?: string, cfId?: string, originalError?: Error}>}>}
     */
    async createAwsAccessKey(userName, save=false){
        const iam = new AWS.IAM()
        const currentKey = AWS.config.credentials.accessKeyId
        const newKey = await iam.createAccessKey({UserName: userName}).promise()
        let disableOldKey = true
        if( save ) {
            try {
                const credentialsBackup = `${this.credentialsPath}_orig`
                fs.copyFileSync(this.credentialsPath, credentialsBackup)
                const profilesConfig = ini.parse(fs.readFileSync(this.credentialsPath, 'utf-8'))
                for ( const profileName in profilesConfig ) {
                    const profile = profilesConfig[profileName]
                    if ( profile.aws_access_key_id === currentKey ) {
                        profile.aws_access_key_id = newKey.AccessKey.AccessKeyId
                        profile.aws_secret_access_key = newKey.AccessKey.SecretAccessKey
                    }
                }
                fs.writeFileSync(this.credentialsPath, ini.stringify(profilesConfig))
                //this.display.warn(`A copy of your original '${this.credentialsPath}' file has been created as '${credentialsBackup}'.`)
            } catch(err){
                disableOldKey = false
                //this.display.warn(`There was an issue saving your new credentials to '${this.credentialsPath}'. However, your old Access Key, '${currentKey}' , is still available, but may be 'Disabled'.`)
            }
        }
        if (disableOldKey) {
            await iam.updateAccessKey({
                AccessKeyId: currentKey,
                Status: "Inactive",
                UserName: userName
            }).promise()
        }
        return newKey
    }

    /**
     * Generates and returns a link to the user’s IAM page.
     * @return {Promise<string>}
     */
    async createAwsConsoleLink(){
        const awsID = await this.fetchCallerIdentity()
        const iam = new AWS.IAM()
        const aliases = await iam.listAccountAliases().promise()
        const prefix = aliases.AccountAliases.length > 0 ? aliases.AccountAliases[0] : awsID.Account
        return `https://${prefix}.signin.aws.amazon.com/console`
    }

    /**
     * Removes an AWs Access Key matching the given Access Key ID and UserName.
     * @param {string} keyId
     * @param {string} userName
     * @return {Promise<PromiseResult<{}, Error & {code: string, message: string, retryable?: boolean, statusCode?: number, time: Date, hostname?: string, region?: string, retryDelay?: number, requestId?: string, extendedRequestId?: string, cfId?: string, originalError?: Error}>>}
     */
    async deleteAccessKey(keyId, userName){
        const iam = new AWS.IAM()
        return await iam.deleteAccessKey({
            AccessKeyId: keyId,
            UserName: userName
        }).promise()
    }

    /**
     * Fetch the Identity information: UserId (aka AccessKey or Role), Account, Arn
     * @param {string} filter
     * @returns {Promise<(STS.GetCallerIdentityResponse & {$response: Response<STS.GetCallerIdentityResponse, Error & {code: string, message: string, retryable?: boolean, statusCode?: number, time: Date, hostname?: string, region?: string, retryDelay?: number, requestId?: string, extendedRequestId?: string, cfId?: string, originalError?: Error}>})|*>}
     */
    async fetchCallerIdentity(filter=""){
        filter = (filter.toString()).trim()
        const sts = new AWS.STS()
        const identity =  await sts.getCallerIdentity().promise()
        if( filter.length > 0 ) {
            return identity[filter] ? identity[filter] : ""
        }
        return identity
    }

    /**
     * Fetches the AWS credentials file from the default location, unless defined in the `AWS_SHARED_CREDENTIALS_FILE` env var.
     * @param {string} profileName
     * @returns {AWS.IniFileContent|*}
     */
    fetchProfiles(profileName=""){
        profileName = (profileName.toString()).trim()
        const iniLoader = new AWS.IniLoader()
        let params = {filename: this.credentialsPath}
        const profiles = iniLoader.loadFrom(params)
        if ( profileName.length > 0 ) {
            return typeof profiles[profileName] !== "undefined" ? profiles[profileName] : {}
        }
        return profiles
    }

    /**
     * Returns the IAM Username from an IAM USer ARN
     * @param {string} arn Example: arn:aws:iam::123456789:user/jsmith
     * @return {string} Example: Returns 'jsmith' from the example ARN.
     */
    getUserNameFromArn(arn){
        if(typeof arn !== "string"){
            throw new TypeError("Expects ARN to be a String.")
        }
        const split = arn.split("/")
        return split[split.length -1]
    }

    /**
     * Checks if there are 2 Access Keys for a given user. If so, it returns the Access Key Object for the one not currently being used by the SDK.
     * @return {Promise<boolean>}
     */
    async keysNeedCleanup(){
        const userName = this.getUserNameFromArn(await this.fetchCallerIdentity("Arn"))
        const keys = await this._fetchAccessKeys(userName)
        if ( this.accessKeysFull(keys) ) {
            let trashKey
            keys.forEach((key)=>{
                if ( key.AccessKeyId !== AWS.config.credentials.accessKeyId ) {
                    trashKey = key
                }
            })
            return trashKey
        }
        return false
    }

}

module.exports = AwsTools;
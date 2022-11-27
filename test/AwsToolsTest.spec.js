const {join} = require('path');

describe('AwsTools', () => {

    process.env['AWS_CONFIG_FILE'] = join(__dirname, "/data/config")
    process.env['AWS_SHARED_CREDENTIALS_FILE'] = join(__dirname, '/data/credentials');
    process.env['AWS_SDK_LOAD_CONFIG'] = "1"

    const _awsTools = require('../lib/AwsTools.js');
    const AWS = require('aws-sdk-mock');
    AWS.setSDKInstance(require('aws-sdk'));

    const _accessKeys = require('./data/accessKeys.json');

    const ACCESS_KEYS = [
        {
            AccessKeyId: _accessKeys[0],
            CreateDate: '2017-11-29T22:02:08.000Z',
            Status: 'Disabled',
            UserName: 'Tester One'
        },
        {
            AccessKeyId: _accessKeys[1],
            CreateDate: '2017-11-29T22:03:08.000Z',
            Status: 'Active',
            UserName: 'Tester One'
        },
        {
            AccessKeyId: _accessKeys[2],
            CreateDate: `${new Date().toISOString()}.000Z`,
            SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY",
            Status: "Active",
            UserName: 'Tester One'
        }
    ];
    const PROFILE_NAME = 'testing';
    const ACCOUNT_ID = '123456789012';

    const awsTools = new _awsTools(PROFILE_NAME);

    beforeEach(() => {
        AWS.mock('IAM', 'changePassword');
        AWS.mock('IAM', 'createAccessKey', {
            AccessKey: ACCESS_KEYS[2]
        });
        AWS.mock('IAM', 'deleteAccessKey');
        AWS.mock('IAM', 'updateAccessKey');
        AWS.mock('IAM', 'listAccessKeys', (params, callback) => {
            callback(null, {
                AccessKeyMetadata: ACCESS_KEYS
            });
        });
        AWS.mock('IAM', 'getAccountPasswordPolicy', (params, callback) => {
            callback(null, {
                PasswordPolicy: {
                    MinimumPasswordLength: 12,
                    RequireLowercaseCharacters: true,
                    RequireNumbers: true,
                    RequireSymbols: true,
                    RequireUppercaseCharacters: true
                }
            });
        });
        AWS.mock('STS', 'getCallerIdentity', {
            Account: ACCOUNT_ID,
            Arn: `arn:aws:iam::123456789012:user/${PROFILE_NAME}`,
            UserId: "AKIAI44QH8DHBEXAMPLE"
        })
    });

    afterEach(() => {
        AWS.restore();
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        test('should create an instance of AwsTools', () => {
            expect(awsTools).toBeInstanceOf(_awsTools);
        });

        test('Should set the class properties.', () => {
            expect(awsTools.profileName).toEqual(PROFILE_NAME);
            expect(awsTools.credentialsPath).toEqual(process.env.AWS_SHARED_CREDENTIALS_FILE);
            expect(awsTools.accessKeysMax).toEqual(2);
        });
    });

    describe('accessKeysFull()', () => {

        test('Should return FALSE with one key.', () => {
            const keys = [{AccessKeyId: '1234567890'}];
            expect(awsTools.accessKeysFull(keys)).toBeFalsy();
        });

        test('Should return TRUE with two keys.', () => {
            const keys = [{AccessKeyId: '1234567890'}, {AccessKeyId: '0987654321'}];
            expect(awsTools.accessKeysFull(keys)).toBeTruthy();
        });
    })

    describe('changePassword()', () => {

        const awsSymbols = new RegExp(/[!@#$%^&*()_+-=[]{}|']/)

        test('Should return a string.', async () => {
            const password = await awsTools.changePassword('oldPassword');
            expect(typeof password).toBe('string');
            expect(password.length).toBeGreaterThanOrEqual(12);
            expect(password).toMatch(/[a-z]/);
            expect(password).toMatch(/[A-Z]/);
            expect(password).toMatch(/[0-9]/);
            expect(password).toMatch(awsSymbols);
            expect(password).not.toBe('oldPassword');
        });
    })

    describe('createAwsAccessKey()', () => {

            test('Should return an access key, and not save a backup.', async () => {
                const fs = require('fs');
                const spy = jest.spyOn(fs, 'writeFileSync');
                const accessKey = await awsTools.createAwsAccessKey(PROFILE_NAME);
                expect(accessKey).toHaveProperty('AccessKey');
                expect(accessKey.AccessKey).toHaveProperty('AccessKeyId');
                expect(accessKey.AccessKey).toHaveProperty('SecretAccessKey');
                expect(spy).not.toHaveBeenCalled();
            });

            test('Should return an access key, and save a backup.', async () => {
                const fs = require('fs');
                const spyWrite = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
                const spyCopy = jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
                const accessKey = await awsTools.createAwsAccessKey(PROFILE_NAME, true);
                expect(accessKey).toHaveProperty('AccessKey');
                expect(accessKey.AccessKey).toHaveProperty('AccessKeyId');
                expect(accessKey.AccessKey).toHaveProperty('SecretAccessKey');
                expect(spyWrite).toHaveBeenCalled();
                expect(spyCopy).toHaveBeenCalled();
            });

            test('Should replace the current AccessKey with the new one, but will not disable old key on failure.', async () => {
                const fs = require('fs');
                const spyWrite = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
                    throw new Error();
                });
                const spyCopy = jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
                const updateAccessKey = jest.fn().mockImplementation(() => {});
                AWS.remock('IAM', 'updateAccessKey', updateAccessKey);
                const accessKey = await awsTools.createAwsAccessKey(PROFILE_NAME, true);
                expect(accessKey).toHaveProperty('AccessKey');
                expect(accessKey.AccessKey).toHaveProperty('AccessKeyId');
                expect(accessKey.AccessKey).toHaveProperty('SecretAccessKey');
                expect(spyWrite).toHaveBeenCalled();
                expect(spyCopy).toHaveBeenCalled();
                expect(updateAccessKey).not.toHaveBeenCalled();
            });
    });

    describe('createAwsConsoleLink()', () => {
        test('Should return a string with an account alias.', async () => {
            const alias = 'myAlias';
            AWS.mock('IAM', 'listAccountAliases', {AccountAliases: [alias]})
            const link = await awsTools.createAwsConsoleLink();
            expect(typeof link).toBe('string');
            expect(link).toEqual(`https://${alias}.signin.aws.amazon.com/console`);
        });

        test('Should return a string with an account ID.', async () => {
            AWS.mock('IAM', 'listAccountAliases', {AccountAliases: []})
            const link = await awsTools.createAwsConsoleLink();
            expect(typeof link).toBe('string');
            expect(link).toEqual(`https://${ACCOUNT_ID}.signin.aws.amazon.com/console`);
        });
    });

    describe('deleteAwsAccessKey()', () => {

        test('Should delete an access key.', async () => {
            expect(await awsTools.deleteAccessKey(_accessKeys[0], PROFILE_NAME)).toBeUndefined();
        });
    })

    describe('fetchCallerIdentity()', () => {
        test('Should return an object with an Account ID as a property.', async () => {
            const identity = await awsTools.fetchCallerIdentity();
            expect(typeof identity).toBe('object');
            expect(identity.Account).toEqual(ACCOUNT_ID);
        });

        test('Should return the AccountId when the filter is used.', async () => {
            const identity = await awsTools.fetchCallerIdentity('Account');
            expect(identity).toEqual(ACCOUNT_ID);
        });
    });

    describe('fetchProfiles()', () => {

        it('Should return an object.', () => {
            expect(typeof _awsTools.fetchProfiles()).toBe('object');
        });

        it('Should return an object with a length of 2.', () => {
            const result = _awsTools.fetchProfiles(PROFILE_NAME);
            expect(Object.keys(result).length).toBe(2);
        });
    });

    describe('getUserNameFromArn()', () => {

        test('Should return a string with the username.', () => {
            const arn = `arn:aws:iam::123456789012:user/${PROFILE_NAME}`;
            const result = awsTools.getUserNameFromArn(arn);
            expect(typeof result).toBe('string');
            expect(result).toBe(PROFILE_NAME);
        });

        test('Should fail if the parameter is not a string.', () => {
            expect(() => awsTools.getUserNameFromArn()).toThrow();
        });
    });

    describe('keysNeedCleanup()', () => {

        test('Should return an object if number of keys exceeds max.', async () => {
            const result = await awsTools.keysNeedCleanup();
            expect(typeof result).toBe('object');
            expect(result).toHaveProperty('AccessKeyId');
            expect(result.AccessKeyId).toEqual(_accessKeys[2]);

        });

        test('Should return false if number of keys does not exceed max.', async () => {
            AWS.remock('IAM', 'listAccessKeys', (params, callback) => {
                callback(null, {
                    AccessKeyMetadata: [ACCESS_KEYS[0]]
                });
            });
            const result = await awsTools.keysNeedCleanup();
            expect(result).toBe(false);
        });
    });
});
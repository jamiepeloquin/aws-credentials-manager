const inquirer = require('inquirer');

describe('prompts', () => {

    const _sut = require('../lib/prompts.js');

    beforeAll(() => {
    });

    afterAll(() => {
        jest.resetAllMocks();
    });

    describe('getStarted()', () => {
        const _promptSpy = spyOn(inquirer, 'prompt').mockImplementation((val) => {});
        test('Should return an object with a property of "action".', async () => {
            await _sut.getStarted();
            expect(_promptSpy).toHaveBeenCalled();
        });
    });

});

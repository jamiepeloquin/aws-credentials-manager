describe('prerequisites', () => {

    const _sut = require('../lib/prerequisites.js');

    beforeAll(() => {
    });

    afterAll(() => {
    });

    describe('checkBinary', () => {
        test('Should return true if the binary exists', () => {
            expect(_sut.checkBinary('node')).toBe(true);
        });

        test('Should return false if the binary does not exist', () => {
            expect(_sut.checkBinary('foobar')).toBe(false);
        });
    });

    describe('checkBinaries', () => {
        test('Should return true if all binaries exist', () => {
            expect(_sut.checkBinaries(['node', 'npm'])).toBe(true);
        });

        test('Should throw if any binary does not exist', () => {
            expect(() => _sut.checkBinaries(['node', 'foobar'])).toThrow();
        });

        test('Should throw if parameter is not an array of strings.', () => {
            expect(() => _sut.checkBinaries(['node', 123])).toThrow();
        });
    });

});

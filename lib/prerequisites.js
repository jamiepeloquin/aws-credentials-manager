const cp = require('child_process');

module.exports = {
    /**
     * Check for the existence of a system binary for either *NIX or Windows.
     * @param {string} binName
     * @returns {boolean}
     */
    checkBinary: function(binName) {
        if ( binName.length > 0 ) {
            // 'which' = *NIX, 'where' = Windows
            const cmd = process.platform === "win32" ? "where" : "which"
            const cl = `${cmd} ${binName}`;
            try {
                cp.execSync(cl);
            } catch(err) {
                return false;
            }
        }
        return true;
    },

    /**
     * Checks for the existence of multiple system binaries.
     * @param {Array} list
     * @returns {*[]|boolean}
     */
    checkBinaries: function(list) {
        const listCount = list.length;
        let errors = [];

        if (listCount > 0) {
            list.forEach((item)=>{
                if(typeof item === "string"){
                    if ( !this.checkBinary(item) ) {
                        errors.push(`⊗ Required '${item}' not installed.`)
                    }
                } else {
                    throw new TypeError("Expects an Array of Strings.")
                }
            })
        }
        if( errors.length > 0) {
            throw new Error(errors.join("\n"));
        }
        return true;
    }
}
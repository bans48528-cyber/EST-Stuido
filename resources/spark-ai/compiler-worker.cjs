'use strict';
// Compile only. Never load or execute the user's Python/bytecode.
try {
    const addon = require(process.argv[2]);
    const status = addon.compile('program.py', 'program.py.o');
    if (process.send) process.send({status});
    process.exitCode = status === 0 ? 0 : 1;
} catch (error) {
    if (process.send) process.send({error: String(error.message).slice(0, 1000)});
    process.exitCode = 1;
}

const argv = require('minimist')(process.argv.slice(2));
const express = require('express');
const StdMsg = require('@liuyuekeng/stdmsg').default;

if (argv.h || argv.help) {
    const help = `
    Options:
        --work-path                     setting up your work-path
        --port                          setting up server port of static resources
        --static-root                   setting up root of static resources
    `;
    console.info(help);
    process.exit(0);
}

const REQUIRED_ARV = ['work-path', 'port'];
REQUIRED_ARV.forEach(v => {
    if (!argv[v]) {
        console.error(`argv "${v}" required`);
        process.exit(1);
    }
});

const WORK_PATH = argv['work-path'];
const PORT = argv['port'];
const STATIC_ROOT = argv['static-root'] || '/output';

run(WORK_PATH);

function run(workPath) {
    const app = express();
    app.use(STATIC_ROOT, express.static(WORK_PATH));
    try {
        app.listen(PORT);
    } catch (e) {
        console.error('server port conflict');
        process.exit(1);
    }
    let stdMsg = new StdMsg(
        'swanCompilation',
        'swanIdeCli',
        process.stdin,
        process.stdout)
    stdMsg.listen((err, data) => {
        if (!err && data.content) {
            let type = data.content.type;
            switch(type) {
                case 'compile': {
                    stdMsg.send({
                        type: 'compile.end',
                        data: {
                            compileMode: 'hot',
                            compileTime: {total: 0},
                            // to trigger simulator refresh
                            fakeCompile: true,
                        }
                    });
                    stdMsg.send({
                        type: 'compile.staticResourceReady',
                        data: {}
                    });
                    break;
                }
            }
        }
    });
    stdMsg.send({type: 'listening'});
    stdMsg.send({
        type: 'compile.end',
        data:  {compileTime: {sum: 0}}
    });
    stdMsg.send({
        type: 'compile.staticResourceReady',
        data: {}
    });
}
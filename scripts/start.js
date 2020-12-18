const chokidar = require('chokidar');
const child_process = require('child_process');
const { BUILD, SRC } = require('./common');
const statik = require('node-static');
const pc = require('picocolors')

const watcherLog = (...args) => console.log(pc.green(`[watcher]: ${args.map(x => x.toString()).join(', ')}`))
const serverLog = (...args) => console.log(pc.blue(`[server]: ${args.map(x => x.toString()).join(', ')}`))

async function makeWatcher(rebuild) {
  try {
    await rebuild();

    let bundling = false;
    let bundleAgain = false;
    chokidar.watch(SRC).on('all', (_e) => {
      if (bundling) {
        bundleAgain = true;
        return;
      }
      bundling = true;

      function rebuildDebounced() {
        watcherLog(`Rebuilding...`);
        rebuild()
          .then(
            () => {
              watcherLog('Done!');
            },
            (e) => {
              watcherLog(pc.red(`Error while rebuilding! ${e.message}`));
            },
          )
          .then(() => {
            if (bundleAgain) {
              bundleAgain = false;
              rebuildDebounced();
            } else {
              bundling = false;
            }
          });
      }

      rebuildDebounced();
    });

    return new Promise(() => {})
  } catch (e) {
    watcherLog(pc.red(`Error while rebuilding. ${e.message}`))
  }
}


makeWatcher(() => {
  return new Promise((resolve, reject) => {
    child_process.exec('npm run all build:to-rebuild:*', {}, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    })
  })
}).catch((e) => {
  watcherLog(pc.red(`Error while watching. ${e.message}`));
})


serverLog('Start watching on http://localhost:8080')
const file = new statik.Server(BUILD, { cache: 0 });
require('http').createServer(function (request, response) {
  request.addListener('end', function () {
    file.serve(request, response);
  }).resume();
}).listen(8080);

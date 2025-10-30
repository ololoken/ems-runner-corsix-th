import { Module, ModuleInitParams } from '../../types/Module';

import wasm from './corsix-th.wasm?url'
import data from './corsix-th.data?url'
import corsixth from './corsix-th'

export const ModuleInstance = ({ ENV, reportDownloadProgress, pushMessage, canvas, onExit, ...rest }: ModuleInitParams) => {
  let module: Module;
  return corsixth(module = <Module>{
    print: msg => pushMessage?.(msg),
    printErr: msg => pushMessage?.(msg),
    canvas,
    preInit: [() => {
      Object.assign(module.ENV, ENV)
    }],
    preRun: [
      () => {
        module.addRunDependency('fs-sync')
        module.FS.mkdir(`${ENV.HOME}`);
        module.FS.mount(module.FS.filesystems.IDBFS, { root: '/' }, `${ENV.HOME}`);
        module.FS.syncfs(true, err => {
          if (err) throw err;
          module.removeRunDependency('fs-sync')
        });
      },
    ],
    noInitialRun: true,
    onExit,
    locateFile: (path: string) => {
      if (path.endsWith('wasm')) return wasm;
      if (path.endsWith('data')) return data;
      throw(`Unknown file[${path}] is requested by corsix-th.js module; known urls are: ${[wasm, data]}`);
    },
    setStatus: (status: string | {}) => {
      if (!status) return;
      if (typeof status === 'string') {
        pushMessage(status);
        const dlProgressRE = /(?<progress>\d+)\/(?<total>\d+)/ig;
        if (!dlProgressRE.test(status)) return;
        dlProgressRE.lastIndex = 0;
        const { groups: { progress, total } } = [...status.matchAll(dlProgressRE)][0] as unknown as { groups: { progress: number, total: number } };
        reportDownloadProgress?.(Math.round(progress / total * 100));
      }
    },
    ...rest
  });
}

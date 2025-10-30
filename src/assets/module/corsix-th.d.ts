import { Module } from '../../types/Module';

export = quakespasm;
declare function quakespasm(moduleArg?: Partial<Module>): Promise<Module>;
declare namespace quakespasm {
    export { quakespasm as default };
}

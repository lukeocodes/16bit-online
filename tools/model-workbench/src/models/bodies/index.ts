import { registry } from "../registry";
import { HumanBody } from "./HumanBody";
import { ElfBody } from "./ElfBody";
import { DwarfBody } from "./DwarfBody";

registry.register(new HumanBody());
registry.register(new ElfBody());
registry.register(new DwarfBody());

import { registry } from "../registry";
import { HumanBody } from "./HumanBody";
import { ElfBody } from "./ElfBody";
import { DwarfBody } from "./DwarfBody";
import { SkeletonBody } from "./SkeletonBody";
import { GoblinBody } from "./GoblinBody";
import { RabbitBody } from "./RabbitBody";

registry.register(new HumanBody());
registry.register(new ElfBody());
registry.register(new DwarfBody());
registry.register(new SkeletonBody());
registry.register(new GoblinBody());
registry.register(new RabbitBody());

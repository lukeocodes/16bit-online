import { registry } from "../registry";
import { HairShort } from "./HairShort";
import { HairLong } from "./HairLong";
import { HairPonytail } from "./HairPonytail";
import { HairMohawk } from "./HairMohawk";
import { HairBraided } from "./HairBraided";
import { HairBald } from "./HairBald";

registry.register(new HairShort());
registry.register(new HairLong());
registry.register(new HairPonytail());
registry.register(new HairMohawk());
registry.register(new HairBraided());
registry.register(new HairBald());

import { registry } from "../registry";
import { ArmorCloth } from "./ArmorCloth";
import { ArmorLeather } from "./ArmorLeather";
import { ArmorMail } from "./ArmorMail";
import { ArmorPlate } from "./ArmorPlate";

registry.register(new ArmorCloth());
registry.register(new ArmorLeather());
registry.register(new ArmorMail());
registry.register(new ArmorPlate());

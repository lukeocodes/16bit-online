import { registry } from "../registry";
import { HelmetPlate } from "./HelmetPlate";
import { CoifMail } from "./CoifMail";

registry.register(new HelmetPlate());
registry.register(new CoifMail());

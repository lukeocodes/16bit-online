import { registry } from "../registry";
import { HelmetPlate } from "./HelmetPlate";
import { CoifMail } from "./CoifMail";
import { HoodCloth } from "./HoodCloth";
import { CapLeather } from "./CapLeather";
import { Crown } from "./Crown";
import { HelmHorned } from "./HelmHorned";

registry.register(new HelmetPlate());
registry.register(new CoifMail());
registry.register(new HoodCloth());
registry.register(new CapLeather());
registry.register(new Crown());
registry.register(new HelmHorned());

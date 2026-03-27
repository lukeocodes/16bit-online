import { registry } from "../registry";
import { WeaponSword } from "./WeaponSword";
import { WeaponAxe } from "./WeaponAxe";
import { WeaponMace } from "./WeaponMace";
import { WeaponSpear } from "./WeaponSpear";
import { WeaponBow } from "./WeaponBow";
import { WeaponStaff } from "./WeaponStaff";
import { WeaponWand } from "./WeaponWand";
import { WeaponDagger } from "./WeaponDagger";

registry.register(new WeaponSword());
registry.register(new WeaponAxe());
registry.register(new WeaponMace());
registry.register(new WeaponSpear());
registry.register(new WeaponBow());
registry.register(new WeaponStaff());
registry.register(new WeaponWand());
registry.register(new WeaponDagger());

export {
  WeaponSword,
  WeaponAxe,
  WeaponMace,
  WeaponSpear,
  WeaponBow,
  WeaponStaff,
  WeaponWand,
  WeaponDagger,
};

import { registry } from "../registry";
import { WeaponSword } from "./WeaponSword";
import { WeaponAxe } from "./WeaponAxe";
import { WeaponMace } from "./WeaponMace";
import { WeaponSpear } from "./WeaponSpear";
import { WeaponBow } from "./WeaponBow";
import { WeaponStaff } from "./WeaponStaff";
import { WeaponWand } from "./WeaponWand";
import { WeaponDagger } from "./WeaponDagger";
import { WeaponCrossbow } from "./WeaponCrossbow";
import { WeaponFlail } from "./WeaponFlail";
import { WeaponHalberd } from "./WeaponHalberd";
import { WeaponThrowingKnife } from "./WeaponThrowingKnife";

registry.register(new WeaponSword());
registry.register(new WeaponAxe());
registry.register(new WeaponMace());
registry.register(new WeaponSpear());
registry.register(new WeaponBow());
registry.register(new WeaponStaff());
registry.register(new WeaponWand());
registry.register(new WeaponDagger());
registry.register(new WeaponCrossbow());
registry.register(new WeaponFlail());
registry.register(new WeaponHalberd());
registry.register(new WeaponThrowingKnife());

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

import { Constructor } from "@/shared/types/Constructor";
import { Registry } from "../di/Registry";

export function Injectable(options: { singleton?: boolean } = {}): ClassDecorator {
  return (target) => {
    Registry.getInstance().register(target as unknown as Constructor, options.singleton);
  };
}

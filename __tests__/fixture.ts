import { crc16, serialize, Field } from "../src/domain/core";
export const fields: Field[] = [
  { id: "00", value: "01" },
  { id: "01", value: "11" },
  { id: "26", value: "0012TEST.PROFILE0105ROUTE" },
  { id: "52", value: "0000" },
  { id: "53", value: "608" },
  { id: "58", value: "PH" },
  { id: "59", value: "TEST ONLY" },
  { id: "60", value: "MANILA" },
  { id: "70", value: "UNKNOWN" },
];
export function fixture(f: Field[] = fields) {
  const b = serialize(f) + "6304";
  return b + crc16(b);
}

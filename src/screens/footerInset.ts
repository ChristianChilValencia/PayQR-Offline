import { createContext, useContext } from "react";

export const FooterInsetContext = createContext(0);
export const useFooterInset = () => useContext(FooterInsetContext);

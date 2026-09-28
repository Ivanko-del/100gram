import { useEffect, useState } from "react";
import {
  AXIOMA_PROJECT_ID,
  AxiomaAccount,
  axiomaLogin,
  axiomaLogout,
  initAxioma,
  linkAxioma,
  subscribeAxioma,
  unlinkAxioma,
} from "../axioma";

export function useAxioma() {
  const [account, setAccount] = useState<AxiomaAccount | null | undefined>(undefined);

  useEffect(() => {
    initAxioma();
    const unsub = subscribeAxioma(setAccount);
    return unsub;
  }, []);

  const loggedIn = account !== null && account !== undefined;
  const linked = loggedIn && AXIOMA_PROJECT_ID in account.partners;

  async function login(nick: string, password: string) {
    await axiomaLogin(nick, password);
  }

  async function link(myUsername: string) {
    await linkAxioma(myUsername);
  }

  async function unlink() {
    await unlinkAxioma();
  }

  async function logout() {
    await axiomaLogout();
  }

  return {
    /** undefined while the session is still being restored, null when
     * signed out, otherwise the live card state. */
    account,
    ready: account !== undefined,
    loggedIn,
    linked,
    login,
    link,
    unlink,
    logout,
  };
}

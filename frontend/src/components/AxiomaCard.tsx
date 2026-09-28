import { FormEvent, useState } from "react";
import { AxiomaError, AXIOMA_EXCHANGE_RATE, withdrawFromAxioma } from "../axioma";
import { topUpGramsFromAxioma } from "../data/firestore-api";
import { useAxioma } from "../hooks/useAxioma";
import { User } from "../types";

const TOPUP_PRESETS = [50, 100, 250, 500];

interface Props {
  user: User;
}

export default function AxiomaCard({ user }: Props) {
  const { account, ready, loggedIn, linked, login, link, unlink } = useAxioma();

  const [nick, setNick] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [linking, setLinking] = useState(false);

  const [topupAmount, setTopupAmount] = useState(100);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [topupSuccess, setTopupSuccess] = useState<string | null>(null);
  const [toppingUp, setToppingUp] = useState(false);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      await login(nick.trim(), password);
      setPassword("");
    } catch (err) {
      setLoginError(err instanceof AxiomaError ? err.message : "Не вдалося увійти");
    } finally {
      setLoggingIn(false);
    }
  }

  async function onLink() {
    setLinking(true);
    try {
      await link(user.username);
    } catch {
      setLoginError("Не вдалося прив'язати картку");
    } finally {
      setLinking(false);
    }
  }

  async function onTopUp(e: FormEvent) {
    e.preventDefault();
    setTopupError(null);
    setTopupSuccess(null);
    if (!(topupAmount > 0)) {
      setTopupError("Вкажи суму більшу за 0");
      return;
    }
    setToppingUp(true);
    try {
      await withdrawFromAxioma(topupAmount, "Поповнення ГРАМ у 100 ГРАМ");
      const grams = Math.round(topupAmount * AXIOMA_EXCHANGE_RATE);
      await topUpGramsFromAxioma(user.id, grams, topupAmount);
      setTopupSuccess(`+${grams} ГРАМ зараховано ✓`);
      setTimeout(() => setTopupSuccess(null), 3000);
    } catch (err) {
      setTopupError(err instanceof AxiomaError ? err.message : "Не вдалося поповнити");
    } finally {
      setToppingUp(false);
    }
  }

  if (!ready) {
    return (
      <div className="axioma-card">
        <h3 style={{ marginTop: 0 }}>💳 Аксіома Банк</h3>
        <p className="settings-hint">Завантаження…</p>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <form className="axioma-card" onSubmit={onLogin}>
        <h3 style={{ marginTop: 0 }}>💳 Поповнити з Аксіоми</h3>
        <p className="settings-hint">
          Увійди в акаунт Аксіома Банку (окремий від 100 ГРАМ), щоб поповнювати ГРАМи з
          віртуальної картки. Акаунт Аксіоми має бути вже відкритий у самому застосунку Аксіоми.
        </p>
        <label>
          Нік Аксіоми
          <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="твій нік" />
        </label>
        <label>
          Пароль Аксіоми
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {loginError && <div className="auth-error">{loginError}</div>}
        <button className="btn-primary" type="submit" disabled={loggingIn || !nick.trim() || !password}>
          {loggingIn ? "Вхід…" : "Увійти в Аксіому"}
        </button>
      </form>
    );
  }

  if (!linked) {
    return (
      <div className="axioma-card">
        <h3 style={{ marginTop: 0 }}>💳 {account!.name}</h3>
        <p className="settings-hint">Картку Аксіоми ще не прив'язано до цього акаунта 100 ГРАМ.</p>
        {loginError && <div className="auth-error">{loginError}</div>}
        <button className="btn-primary" onClick={onLink} disabled={linking} style={{ width: "fit-content" }}>
          {linking ? "Прив'язка…" : "Прив'язати картку"}
        </button>
      </div>
    );
  }

  const card = account!.card;

  return (
    <div className="axioma-card">
      <h3 style={{ marginTop: 0 }}>💳 Картка Аксіоми · {account!.name}</h3>
      <div className="axioma-balance-row">
        <span>
          Баланс: <b>{card.balance} ₴</b>
        </span>
        {card.frozen && <span className="admin-badge" style={{ color: "var(--danger)" }}>заблокована</span>}
        <button type="button" className="btn-ghost axioma-unlink" onClick={unlink}>
          Відв'язати
        </button>
      </div>

      <form onSubmit={onTopUp}>
        <label>Скільки ГРАМів поповнити (1 ГРАМ = {AXIOMA_EXCHANGE_RATE} ₴)</label>
        <div className="topup-presets">
          {TOPUP_PRESETS.map((v) => (
            <button
              type="button"
              key={v}
              className={`plan-card topup-preset ${topupAmount === v ? "selected" : ""}`}
              onClick={() => setTopupAmount(v)}
            >
              {v} 🥃
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          max={100000}
          value={topupAmount}
          onChange={(e) => setTopupAmount(Number(e.target.value))}
        />
        {topupError && <div className="auth-error">{topupError}</div>}
        {topupSuccess && <div className="auth-success">{topupSuccess}</div>}
        <button className="btn-primary" type="submit" disabled={toppingUp || card.frozen} style={{ marginTop: 10 }}>
          {toppingUp ? "Поповнення…" : `Списати ${topupAmount} ₴ і зарахувати ГРАМи`}
        </button>
      </form>
    </div>
  );
}

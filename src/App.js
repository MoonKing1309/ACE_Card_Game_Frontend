import JoinGame from "./components/joinGame";
import { useEffect, useState } from "react";
import Home from "./components/home";


function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setLoggedIn(Boolean(token));
  }, []);

  // when logged in we show the JoinGame form (allows joining other rooms),
  // otherwise show the initial Home login/create form.
  return loggedIn ? <JoinGame /> : <Home />;
}

export default App;
export const isLoggedIn = () => Boolean(localStorage.getItem("token"));
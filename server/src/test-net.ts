// Pour les tests : ce qu'un faux contexte de collecte n'utilise pas. Un appel inattendu échoue
// bruyamment au lieu de répondre quelque chose de plausible.
import type { CollectContext } from "./contract.js";

export const NO_POST_NO_SECRET: Pick<CollectContext, "postText" | "secret"> = {
  postText: async (url) => { throw new Error(`test : POST inattendu sur ${url}`); },
  secret: () => null,
};

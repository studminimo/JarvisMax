import { HomeScreen } from "@/features/home/HomeScreen";
import { EMPTY_HOME } from "@/domain/home";

export default function HomeRoute() {
  return <HomeScreen snapshot={EMPTY_HOME} />;
}

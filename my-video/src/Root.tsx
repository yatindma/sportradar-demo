import "./index.css";
import { Composition } from "remotion";
import { ReActVideo } from "./ReActVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ReActDemo"
        component={ReActVideo}
        durationInFrames={3140}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

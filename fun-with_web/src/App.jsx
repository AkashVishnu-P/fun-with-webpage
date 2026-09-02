import React, { useState } from 'react';
import { WebSlingerCanvas } from './components/3d/WebSlingerCanvas.jsx';
import { IntroVideo } from './components/IntroVideo.jsx';

function App() {
  const [showIntro, setShowIntro] = useState(true);

  return (
    <main style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {showIntro && (
        <IntroVideo
          videoSrc="/intro.mp4"
          onComplete={() => setShowIntro(false)}
        />
      )}
      <WebSlingerCanvas />
    </main>
  );
}

export default App;

import App from 'stampy/app';

export function initialize(app: App): void {
  if (document.readyState === 'loading') {
    app.deferReadiness();

    let callback = () => {
      if (document.readyState !== 'loading') {
        app.advanceReadiness();
        document.removeEventListener('readystatechange', callback);
      }
    };

    document.addEventListener('readystatechange', callback);
  }
}

export default {
  initialize
};

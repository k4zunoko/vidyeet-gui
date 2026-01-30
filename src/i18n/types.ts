/** Type definitions for i18n messages */

export type SupportedLocale = 'ja' | 'en';

export interface MessageSchema {
  app: {
    initializing: string;
    loading: string;
    deleteDialog: {
      title: string;
      message: string;
      cancelButton: string;
      deleteButton: string;
      deleting: string;
    };
    upload: {
      failed: string;
      error: string;
      inProgress: string;
      minimizing: string;
      closing: string;
      showDetails: string;
      expand: string;
      waiting: string;
      items: string;
      cancel: string;
    };
    toasts: {
      linkCopied: string;
    };
  };
  settings: {
    title: string;
    close: string;
    update: {
      title: string;
      subtitle: string;
      checking: string;
      checkButton: string;
      status: {
        checking: string;
        available: string;
        latest: string;
        downloading: string;
        ready: string;
        error: string;
        unchecked: string;
      };
      description: {
        checking: string;
        available: string;
        latest: string;
        downloading: string;
        ready: string;
        error: string;
        unchecked: string;
      };
      progress: {
        label: string;
        note: string;
      };
      downloadButton: string;
      restarting: string;
      installButton: string;
      retryButton: string;
      autoUpdateError: string;
    };
    account: {
      title: string;
      logout: string;
    };
    appInfo: {
      title: string;
      version: string;
      cliPath: string;
      loading: string;
      error: string;
    };
    language: {
      label: string;
      ja: string;
      en: string;
    };
  };
   login: {
     appTitle: string;
     subtitle: string;
     tokenId: {
       label: string;
       placeholder: string;
     };
     tokenSecret: {
       label: string;
       placeholder: string;
     };
     error: string;
     loggingIn: string;
     loginButton: string;
     unexpectedError: string;
     hint: {
       prefix: string;
       link: string;
       suffix: string;
     };
   };
  library: {
    error: {
      loadFailed: string;
      unexpected: string;
    };
    retry: string;
    empty: {
      title: string;
      hint: string;
    };
    uploadButton: string;
    uploadAria: string;
  };
  player: {
    selectVideo: string;
    selectHint: string;
    loading: string;
    retry: string;
  };
  videoCard: {
    ariaPrefix: string;
    unplayable: string;
    playing: string;
  };
  contextMenu: {
    ariaLabel: string;
    copyLink: string;
    delete: string;
  };
  infoPanel: {
    duration: string;
    resolution: string;
    aspectRatio: string;
    frameRate: string;
    createdAt: string;
    status: string;
  };
  dragDrop: {
    message: string;
    hint: string;
  };
  titleBar: {
    reload: string;
    settings: string;
    restore: string;
    maximize: string;
    close: string;
  };
  uploadPhase: {
    validating: string;
    validationComplete: string;
    preparing: string;
    prepareComplete: string;
    uploading: string;
    processing: string;
    completed: string;
    done: string;
    starting: string;
  };
  uploadErrors: {
    pathError: string;
    uploadFailed: string;
  };
}

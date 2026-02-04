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
    aria: {
      close: string;
      updateProgress: string;
    };
    categories: {
      account: string;
      security: string;
      notification: string;
      display: string;
      data: string;
      support: string;
      appinfo: string;
    };
    account: {
      section: {
        account: string;
        accountDesc: string;
      };
      status: string;
      statusDesc: string;
      authenticated: string;
      logoutLabel: string;
      logoutDesc: string;
      logout: string;
    };
    security: {
      section: {
        security: string;
        securityDesc: string;
      };
      empty: {
        title: string;
        description: string;
      };
    };
    notification: {
      section: {
        notification: string;
        notificationDesc: string;
      };
      empty: {
        title: string;
        description: string;
      };
    };
    display: {
      section: {
        language: string;
        languageDesc: string;
      };
      language: {
        label: string;
        description: string;
      };
    };
    data: {
      section: {
        templates: string;
        templatesDesc: string;
      };
    };
    support: {
      section: {
        support: string;
        supportDesc: string;
      };
      empty: {
        title: string;
        description: string;
      };
    };
    appInfo: {
      section: {
        info: string;
        infoDesc: string;
        update: string;
        updateDesc: string;
      };
      version: string;
      versionDesc: string;
      cliPath: string;
      cliPathDesc: string;
      loading: string;
      error: string;
    };
    language: {
      label: string;
      ja: string;
      jaDesc: string;
      en: string;
      enDesc: string;
    };
    update: {
      checkButton: string;
      checkingButton: string;
      downloadButton: string;
      installButton: string;
      retryButton: string;
      restarting: string;
      lastChecked: string;
      newVersion: string;
      autoUpdateError: string;
      errorNetwork: string;
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

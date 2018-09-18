// Libraries
import {observable} from "mobx";

// Utils
import * as blockchain from "../utils/blockchain";

// Settings
import * as settings from "../settings";

export default class NetworkStore {
  @observable stopIntervals = false;
  @observable loadingAddress = false;
  @observable accounts = [];
  @observable defaultAccount = null;
  @observable isConnected = false;
  @observable latestBlock = null;
  @observable network = "";
  @observable outOfSync = true;
  @observable hw = {active: false, showSelector: false, option: null, derivationPath: null, addresses: [], loading: false, error: null};
  @observable isHw = false;
  @observable downloadClient = false;

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  setNetwork = async () => {
    try {
      const result = await blockchain.checkNetwork(this.isConnected, this.network);
      Object.keys(result.data).forEach(key => { this[key] = result.data[key]; });
      if (!this.stopIntervals && result.status) {
        this.setAccount();
        if (!this.hw.active) {
          this.setAccountInterval = setInterval(this.setAccount, 1000);
        }
      }
    } catch(e) {
      console.log(e);
    }
  }

  stopNetwork = () => {
    this.stopIntervals = true;
    blockchain.stopProvider();
    clearInterval(this.setAccountInterval);
    clearInterval(this.setNetworkInterval);
    this.network = "";
    this.hw = {active: false, showSelector: false, option: null, derivationPath: null, addresses: [], loading: false, error: null};
    this.accounts = [];
    this.defaultAccount = null;
    this.isConnected = false;
    this.latestBlock = null;
    this.outOfSync = true;
    this.isHw = false;
  }

  setAccount = () => {
    blockchain.getAccounts().then(async accounts => {
      if (this.network && !this.hw.active && accounts && accounts[0] !== blockchain.getDefaultAccount()) {
        const account = await blockchain.getDefaultAccountByIndex(0);
        if (!this.stopIntervals) { // To avoid race condition
          blockchain.setDefaultAccount(account);
        }
      }
      if (!this.stopIntervals) { // To avoid race condition
        const oldDefaultAccount = this.defaultAccount;
        this.defaultAccount = blockchain.getDefaultAccount();
        if (this.defaultAccount && oldDefaultAccount !== this.defaultAccount) {
          this.rootStore.loadContracts();
        }
        if (!this.defaultAccount) {
          this.loadingAddress = false;
        }
      }
    }, () => {});
  }

  // Web3 web client
  setWeb3WebClient = async () => {
    try {
      this.stopIntervals = false;
      this.loadingAddress = true;
      await blockchain.setWebClientProvider();
      this.setNetwork();
      this.setNetworkInterval = setInterval(this.setNetwork, 3000);
    } catch (e) {
      this.loadingAddress = false;
      this.downloadClient = true;
      console.log(e);
    }
  }

  // Hardwallets
  showHW = option => {
    if (option === "ledger") {
      option = `ledger-${localStorage.getItem("loadLedgerLegacy") === "true" ? "legacy" : "live"}`;
    }
    this.hw.option = option;
    this.hw.showSelector = true;
    this.loadHWAddresses();
  }

  hideHw = () => {
    this.hw.active = false;
    this.hw.loading = false;
    this.hw.showSelector = false;
    this.hw.option = "";
    this.hw.derivationPath = false;
  }

  loadHWAddresses = async () => {
    this.hw.loading = true;
    this.hw.active = true;
    this.hw.error = false;
    this.hw.derivationPath = this.hw.option === "ledger-live"
                              ?
                                "44'/60'/0'"
                              :
                                this.hw.option === "ledger-legacy"
                                ?
                                  "44'/60'/0'/0"
                                :
                                  "44'/60'/0'/0/0";
    try {
      await blockchain.setHWProvider(
                                      this.hw.option.replace("-live", "").replace("-legacy", ""),
                                      settings.hwNetwork,
                                      this.hw.derivationPath,
                                      0,
                                      this.hw.option === "ledger-live" ? 5 : 50
                                    );
      const accounts = await blockchain.getAccounts();
      this.hw.addresses = accounts;
    } catch(e) {
      blockchain.stopProvider();
      this.hw.error = `Error connecting ${this.hw.option}: ${e.message}`;
    } finally {
      this.hw.loading = false;
    }
  }

  importAddress = account => {
    try {
      this.stopIntervals = false;
      this.loadingAddress = true;
      this.hw.showSelector = false;
      blockchain.setDefaultAccount(account.toLowerCase());
      this.setNetwork();
      this.setNetworkInterval = setInterval(this.setNetwork, 10000);
    } catch(e) {
      this.loadingAddress = false;
      this.hw.showSelector = true;
      this.hw.addressIndex = null;
      this.hw.addresses = [];
      blockchain.stopProvider();
      this.hw.error = `Error connecting ${this.hw.option}: ${e.message}`;
    }
  }
  //

  stopLoadingAddress = () => {
    this.loadingAddress = false;
  }
}

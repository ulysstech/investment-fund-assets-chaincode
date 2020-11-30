import { Object, Property, Contract } from "fabric-contract-api";

// Define objectType names for prefix
const balancePrefix = "balance";
const allowancePrefix = "allowance";

// Define key names for options
const nameKey = "name";
const symbolKey = "symbol";
const totalSupplyKey = "totalSupply";

const managerName = "ManagerName";
const managementCompany = "managementCompany";

const domiciliation = "domiciliation";
const baseCurrency = "baseCurrency";
const launchDate = "launchDate";
const benchmark = "benchmark";
const assetAllocation = "assetAllocation";

const currentCharge = "currentCharge";
const admissionFees = "admissionFees";
const exitFees = "exitFees";

const legalForm = "legalForm";
const extendedAssetClass = "extendedAssetClass";
const SSRI = "SSRI";
const ISIN = "ISIN";
const SEDOL = "SEDOL";

export class FundContract extends Contract {
  async FundName(ctx) {
    const nameBytes = await ctx.stub.getState(nameKey);
    return nameBytes.toString();
  }

  async Symbol(ctx) {
    const symbolBytes = await ctx.stub.getState(symbolKey);
    return symbolBytes.toString();
  }

  async TotalSupply(ctx) {
    const totalSupplyBytes = await ctx.stub.getState(totalSupplyKey);
    const totalSupply = parseInt(totalSupplyBytes.toString());
    return totalSupply;
  }

  async GetCompanyInfo(ctx) {
    const managerNameBytes = await ctx.stub.getState(managerName);
    const managementCompanyBytes = await ctx.stub.getState(managementCompany);
    const domiciliationBytes = await ctx.stub.getState(domiciliation);
    const launchDateBytes = await ctx.stub.getState(launchDate);
    const benchmarkBytes = await ctx.stub.getState(benchmark);

    return {
      manager: managerNameBytes.toString(),
      company: managementCompanyBytes.toString(),
      domiciliation: domiciliationBytes.toString(),
      benchmark: benchmarkBytes.toString(),
      launchDate: launchDateBytes.toString(),
    };
  }

  async GetFundInfo(ctx) {
    const baseCurrencyBytes = await ctx.stub.getState(baseCurrency);
    const currentChargeBytes = await ctx.stub.getState(currentCharge);
    const admissionFeesBytes = await ctx.stub.getState(admissionFees);
    const exitFeesBytes = await ctx.stub.getState(exitFees);
    const assetAllocationBytes = await ctx.stub.getState(assetAllocation);

    return {
      baseCurrency: baseCurrencyBytes.toString(),
      currentCharge: parseInt(currentChargeBytes.toString()),
      admissionFees: parseInt(admissionFeesBytes.toString()),
      exitFees: parseInt(exitFeesBytes.toString()),
      assetAllocation: assetAllocationBytes.toString(),
    };
  }

  async GetCodeInfo(ctx) {
    const legalFormBytes = await ctx.stub.getState(legalForm);
    const extendedAssetClassBytes = await ctx.stub.getState(extendedAssetClass);
    const SSRIBytes = await ctx.stub.getState(SSRI);
    const SEDOLBytes = await ctx.stub.getState(SEDOL);
    const ISINBytes = await ctx.stub.getState(ISIN);

    return {
      legalForm: legalFormBytes.toString(),
      extendedAssetClass: extendedAssetClassBytes.toString(),
      ISIN: ISINBytes.toString(),
      SEDOL: SEDOLBytes.toString(),
      SSRI: SSRIBytes.toString(),
    };
  }

  async BalanceOf(ctx, owner) {
    const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [owner]);

    const balanceBytes = await ctx.stub.getState(balanceKey);
    if (!balanceBytes || balanceBytes.length === 0) {
      throw new Error(`the account ${owner} does not exist`);
    }
    const balance = parseInt(balanceBytes.toString());

    return balance;
  }

  async Transfer(ctx, to, value) {
    const from = ctx.clientIdentity.getID();

    const transferResp = await this._transfer(ctx, from, to, value);
    if (!transferResp) {
      throw new Error("Failed to transfer");
    }

    // Emit the Transfer event
    const transferEvent = { from, to, value: parseInt(value) };
    ctx.stub.setEvent("Transfer", Buffer.from(JSON.stringify(transferEvent)));

    return true;
  }

  async TransferFrom(ctx, from, to, value) {
    const spender = ctx.clientIdentity.getID();

    // Retrieve the allowance of the spender
    const allowanceKey = ctx.stub.createCompositeKey(allowancePrefix, [
      from,
      spender,
    ]);
    const currentAllowanceBytes = await ctx.stub.getState(allowanceKey);

    if (!currentAllowanceBytes || currentAllowanceBytes.length === 0) {
      throw new Error(`spender ${spender} has no allowance from ${from}`);
    }

    const currentAllowance = parseInt(currentAllowanceBytes.toString());

    // Convert value from string to int
    const valueInt = parseInt(value);

    // Check if the transferred value is less than the allowance
    if (currentAllowance < valueInt) {
      throw new Error("The spender does not have enough allowance to spend.");
    }

    const transferResp = await this._transfer(ctx, from, to, value);
    if (!transferResp) {
      throw new Error("Failed to transfer");
    }

    // Decrease the allowance
    const updatedAllowance = currentAllowance - valueInt;
    await ctx.stub.putState(
      allowanceKey,
      Buffer.from(updatedAllowance.toString())
    );
    console.log(
      `spender ${spender} allowance updated from ${currentAllowance} to ${updatedAllowance}`
    );

    // Emit the Transfer event
    const transferEvent = { from, to, value: valueInt };
    ctx.stub.setEvent("Transfer", Buffer.from(JSON.stringify(transferEvent)));

    console.log("transferFrom ended successfully");
    return true;
  }

  private async _transfer(ctx, from, to, value) {
    // Convert value from string to int
    const valueInt = parseInt(value);

    if (valueInt < 0) {
      // transfer of 0 is allowed in ERC20, so just validate against negative amounts
      throw new Error("transfer amount cannot be negative");
    }

    // Retrieve the current balance of the sender
    const fromBalanceKey = ctx.stub.createCompositeKey(balancePrefix, [from]);
    const fromCurrentBalanceBytes = await ctx.stub.getState(fromBalanceKey);

    if (!fromCurrentBalanceBytes || fromCurrentBalanceBytes.length === 0) {
      throw new Error(`client account ${from} has no balance`);
    }

    const fromCurrentBalance = parseInt(fromCurrentBalanceBytes.toString());

    // Check if the sender has enough tokens to spend.
    if (fromCurrentBalance < valueInt) {
      throw new Error(`client account ${from} has insufficient funds.`);
    }

    // Retrieve the current balance of the recepient
    const toBalanceKey = ctx.stub.createCompositeKey(balancePrefix, [to]);
    const toCurrentBalanceBytes = await ctx.stub.getState(toBalanceKey);

    let toCurrentBalance;
    // If recipient current balance doesn't yet exist, we'll create it with a current balance of 0
    if (!toCurrentBalanceBytes || toCurrentBalanceBytes.length === 0) {
      toCurrentBalance = 0;
    } else {
      toCurrentBalance = parseInt(toCurrentBalanceBytes.toString());
    }

    // Update the balance
    const fromUpdatedBalance = fromCurrentBalance - valueInt;
    const toUpdatedBalance = toCurrentBalance + valueInt;

    await ctx.stub.putState(
      fromBalanceKey,
      Buffer.from(fromUpdatedBalance.toString())
    );
    await ctx.stub.putState(
      toBalanceKey,
      Buffer.from(toUpdatedBalance.toString())
    );

    console.log(
      `client ${from} balance updated from ${fromCurrentBalance} to ${fromUpdatedBalance}`
    );
    console.log(
      `recipient ${to} balance updated from ${toCurrentBalance} to ${toUpdatedBalance}`
    );

    return true;
  }

  async Approve(ctx, spender, value) {
    const owner = ctx.clientIdentity.getID();

    const allowanceKey = ctx.stub.createCompositeKey(allowancePrefix, [
      owner,
      spender,
    ]);

    let valueInt = parseInt(value);
    await ctx.stub.putState(allowanceKey, Buffer.from(valueInt.toString()));

    // Emit the Approval event
    const approvalEvent = { owner, spender, value: valueInt };
    ctx.stub.setEvent("Approval", Buffer.from(JSON.stringify(approvalEvent)));

    console.log("approve ended successfully");
    return true;
  }

  async Allowance(ctx, owner, spender) {
    const allowanceKey = ctx.stub.createCompositeKey(allowancePrefix, [
      owner,
      spender,
    ]);

    const allowanceBytes = await ctx.stub.getState(allowanceKey);
    if (!allowanceBytes || allowanceBytes.length === 0) {
      throw new Error(`spender ${spender} has no allowance from ${owner}`);
    }

    const allowance = parseInt(allowanceBytes.toString());
    return allowance;
  }

  async ClientAccountID(ctx) {
    // Get ID of submitting client identity
    const clientAccountID = ctx.clientIdentity.getID();
    return clientAccountID;
  }
  async ClientAccountBalance(ctx) {
    // Get ID of submitting client identity
    const clientAccountID = ctx.clientIdentity.getID();

    const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [
      clientAccountID,
    ]);
    const balanceBytes = await ctx.stub.getState(balanceKey);
    if (!balanceBytes || balanceBytes.length === 0) {
      throw new Error(`the account ${clientAccountID} does not exist`);
    }
    const balance = parseInt(balanceBytes.toString());

    return balance;
  }

  //------------------------------------------------------------------------------
  //        update general informations
  //------------------------------------------------------------------------------

  async SetOption(ctx, name, symbol) {
    await ctx.stub.putState(nameKey, Buffer.from(name));
    await ctx.stub.putState(symbolKey, Buffer.from(symbol));

    console.log(`name: ${name}, symbol: ${symbol}`);
    return true;
  }

  async SetCompany(
    ctx,
    manager,
    company,
    domiciliation,
    launchDate,
    benchmark
  ) {
    await ctx.stub.putState(manager, Buffer.from(manager));
    await ctx.stub.putState(company, Buffer.from(company));
    await ctx.stub.putState(domiciliation, Buffer.from(domiciliation));
    await ctx.stub.putState(benchmark, Buffer.from(benchmark));

    console.log(
      `manager: ${manager}, company: ${company}, domiciliation: ${domiciliation}, launchDate: ${launchDate}, benchmark: ${benchmark}`
    );
    return true;
  }

  async SetFund(
    ctx,
    baseCurrency,
    currentCharge,
    admissionFees,
    exitFees,
    assetAllocation
  ) {
    await ctx.stub.putState(baseCurrency, Buffer.from(baseCurrency));
    await ctx.stub.putState(currentCharge, Buffer.from(currentCharge));
    await ctx.stub.putState(admissionFees, Buffer.from(admissionFees));
    await ctx.stub.putState(exitFees, Buffer.from(exitFees));
    await ctx.stub.putState(assetAllocation, Buffer.from(assetAllocation));

    console.log(
      `baseCurrency: ${baseCurrency}, currentCharge: ${currentCharge}, admissionFees: ${admissionFees}, exitFees: ${exitFees}, assetAllocation: ${assetAllocation}`
    );
    return true;
  }

  async SetCode(ctx, legalForm, extendedAssetClass, SSRI, SEDOL, ISIN) {
    await ctx.stub.putState(legalForm, Buffer.from(legalForm));
    await ctx.stub.putState(
      extendedAssetClass,
      Buffer.from(extendedAssetClass)
    );
    await ctx.stub.putState(SSRI, Buffer.from(SSRI));
    await ctx.stub.putState(ISIN, Buffer.from(ISIN));
    await ctx.stub.putState(SEDOL, Buffer.from(SEDOL));

    console.log(
      `legalForm: ${legalForm}, extendedAssetClass: ${extendedAssetClass}, SSRI: ${SSRI}, ISIN: ${ISIN}, SEDOL: ${SEDOL}`
    );
    return true;
  }

  //------------------------------------------------------------------------------
  //        for the admin/manager Only
  //------------------------------------------------------------------------------
  async Mint(ctx, amount) {
    // Check minter authorization - this sample assumes Org1 is the central banker with privilege to mint new tokens
    const clientMSPID = ctx.clientIdentity.getMSPID();
    if (clientMSPID !== "Org1MSP") {
      throw new Error("client is not authorized to mint new tokens");
    }

    // Get ID of submitting client identity
    const minter = ctx.clientIdentity.getID();

    const amountInt = parseInt(amount);
    if (amountInt <= 0) {
      throw new Error("mint amount must be a positive integer");
    }

    const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [minter]);

    const currentBalanceBytes = await ctx.stub.getState(balanceKey);
    // If minter current balance doesn't yet exist, we'll create it with a current balance of 0
    let currentBalance;
    if (!currentBalanceBytes || currentBalanceBytes.length === 0) {
      currentBalance = 0;
    } else {
      currentBalance = parseInt(currentBalanceBytes.toString());
    }
    const updatedBalance = currentBalance + amountInt;

    await ctx.stub.putState(balanceKey, Buffer.from(updatedBalance.toString()));

    // Increase totalSupply
    const totalSupplyBytes = await ctx.stub.getState(totalSupplyKey);
    let totalSupply;
    if (!totalSupplyBytes || totalSupplyBytes.length === 0) {
      console.log("Initialize the tokenSupply");
      totalSupply = 0;
    } else {
      totalSupply = parseInt(totalSupplyBytes.toString());
    }
    totalSupply = totalSupply + amountInt;
    await ctx.stub.putState(
      totalSupplyKey,
      Buffer.from(totalSupply.toString())
    );

    // Emit the Transfer event
    const transferEvent = { from: "0x0", to: minter, value: amountInt };
    ctx.stub.setEvent("Transfer", Buffer.from(JSON.stringify(transferEvent)));

    console.log(
      `minter account ${minter} balance updated from ${currentBalance} to ${updatedBalance}`
    );
    return true;
  }

  async Burn(ctx, amount) {
    // Check minter authorization - this sample assumes Org1 is the central banker with privilege to burn tokens
    const clientMSPID = ctx.clientIdentity.getMSPID();
    if (clientMSPID !== "Org1MSP") {
      throw new Error("client is not authorized to mint new tokens");
    }

    const minter = ctx.clientIdentity.getID();

    const amountInt = parseInt(amount);

    const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [minter]);

    const currentBalanceBytes = await ctx.stub.getState(balanceKey);
    if (!currentBalanceBytes || currentBalanceBytes.length === 0) {
      throw new Error("The balance does not exist");
    }
    const currentBalance = parseInt(currentBalanceBytes.toString());
    const updatedBalance = currentBalance - amountInt;

    await ctx.stub.putState(balanceKey, Buffer.from(updatedBalance.toString()));

    // Decrease totalSupply
    const totalSupplyBytes = await ctx.stub.getState(totalSupplyKey);
    if (!totalSupplyBytes || totalSupplyBytes.length === 0) {
      throw new Error("totalSupply does not exist.");
    }
    const totalSupply = parseInt(totalSupplyBytes.toString()) - amountInt;
    await ctx.stub.putState(
      totalSupplyKey,
      Buffer.from(totalSupply.toString())
    );

    // Emit the Transfer event
    const transferEvent = { from: minter, to: "0x0", value: amountInt };
    ctx.stub.setEvent("Transfer", Buffer.from(JSON.stringify(transferEvent)));

    console.log(
      `minter account ${minter} balance updated from ${currentBalance} to ${updatedBalance}`
    );
    return true;
  }
}

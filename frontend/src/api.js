const BASE_URL = '';
const PKG = '#canton-loyalty';

const makeHeaders = () => ({ 'Content-Type': 'application/json' });

export const createParty = async (partyIdHint) => {
  const listRes = await fetch(`/v2/parties?identityProviderId=`, {
    method: 'GET',
    headers: makeHeaders(),
  });
  const listData = await listRes.json();
  const existing = listData.partyDetails?.find(p =>
    p.party.startsWith(partyIdHint + '::')
  );
  if (existing) return existing.party;

  const res = await fetch(`${BASE_URL}/v2/parties`, {
    method: 'POST',
    headers: makeHeaders(),
    body: JSON.stringify({ partyIdHint, identityProviderId: '' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.partyDetails.party;
};

export const getActiveContracts = async (partyId, additionalParties = []) => {
  const endRes = await fetch(`${BASE_URL}/v2/state/ledger-end`, {
    method: 'GET',
    headers: makeHeaders(),
  });
  const endData = await endRes.json();
  const offset = endData.offset;

  const partyFilter = {
    cumulative: [{
      identifierFilter: {
        WildcardFilter: { value: { includeCreatedEventBlob: false } }
      }
    }]
  };

  const filtersByParty = { [partyId]: partyFilter };
  additionalParties.forEach(p => { filtersByParty[p] = partyFilter; });

  const res = await fetch(`${BASE_URL}/v2/state/active-contracts`, {
    method: 'POST',
    headers: makeHeaders(),
    body: JSON.stringify({
      filter: { filtersByParty },
      activeAtOffset: offset,
      verbose: true,
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text);

  const parsed = JSON.parse(text);
  const seen = new Set();
  return parsed
    .filter(entry => entry?.contractEntry?.JsActiveContract)
    .map(entry => entry.contractEntry.JsActiveContract.createdEvent)
    .filter(c => {
      if (seen.has(c.contractId)) return false;
      seen.add(c.contractId);
      return true;
    });
};

const submitCommand = async (actAs, readAs, commands) => {
  const res = await fetch(`${BASE_URL}/v2/commands/submit-and-wait`, {
    method: 'POST',
    headers: makeHeaders(),
    body: JSON.stringify({
      commands,
      userId: 'ledger-api-user',
      commandId: `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      actAs: [actAs],
      readAs: readAs || [actAs],
      workflowId: 'canton-loyalty',
      disclosedContracts: [],
      domainId: '',
      packageIdSelectionPreference: [],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
};

// Customer submits a loyalty application
export const submitApplication = async (customer, airline, customerId, customerName, email) => {
  return submitCommand(customer, [customer, airline], [
    {
      CreateCommand: {
        templateId: `${PKG}:CLP:CLPApplication`,
        createArguments: { customer, airline, customerId, customerName, email },
      },
    },
  ]);
};

// Customer withdraws their application
export const withdrawApplication = async (customer, contractId) => {
  return submitCommand(customer, [customer], [
    {
      ExerciseCommand: {
        templateId: `${PKG}:CLP:CLPApplication`,
        contractId,
        choice: 'WithdrawApplication',
        choiceArgument: {},
      },
    },
  ]);
};

// Airline approves application and creates CLPAccount
export const reviewApplication = async (airline, customer, contractId) => {
  return submitCommand(airline, [airline, customer], [
    {
      ExerciseCommand: {
        templateId: `${PKG}:CLP:CLPApplication`,
        contractId,
        choice: 'ReviewApplication',
        choiceArgument: {},
      },
    },
  ]);
};

// Airline adds points to account
export const addPoints = async (airline, customer, contractId, pointsToAdd) => {
  return submitCommand(airline, [airline, customer], [
    {
      ExerciseCommand: {
        templateId: `${PKG}:CLP:CLPAccount`,
        contractId,
        choice: 'Addpoints',
        choiceArgument: { pointsToAdd },
      },
    },
  ]);
};

// Customer redeems points
export const redeemPoints = async (customer, airline, contractId, pointsToRedeem) => {
  return submitCommand(customer, [customer, airline], [
    {
      ExerciseCommand: {
        templateId: `${PKG}:CLP:CLPAccount`,
        contractId,
        choice: 'RedeemPoints',
        choiceArgument: { pointsToRedeem },
      },
    },
  ]);
};
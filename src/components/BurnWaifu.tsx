import React, { useEffect, useState } from "react";
import styled from "styled-components";
import BN from "bn.js";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Contract } from "web3-eth-contract";
import { ContractHelper } from "../services/contract";
import Input from "./Input";
import Popup from "./Popup";
import LoadingPurchase from "./LoadingPurchase";
import {
  selectWaifusApproved,
  selectWetApproved,
  setWaifusApproved,
  setWetApproved,
} from "../state/reducers/user";
import { selectGlobalsData, selectIsEth } from "../state/reducers/globals";

const Content = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Error = styled.div`
  font-size: 1.2rem;
  margin-top: 0.5rem;
  color: var(--danger);
`;

type Props = {
  show: boolean;
  close: () => void;
};

const BurnWaifu: React.FC<Props> = (props) => {
  if (!props.show) return null;

  let contractHelper: ContractHelper;

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [waifuIds, setWaifuIds] = useState<string>("");
  const [error, setError] = useState("");
  const [approving, setApproving] = useState(false);
  const [committed, setCommited] = useState(false);
  const [commitComplete, setCommitComplete] = useState(false);
  const [isWaifuBurn, setIsWaifuBurn] = useState(false);
  const [isNftxBurn, setIsNftxBurn] = useState(false);
  const wetApproved = useSelector(selectWetApproved);
  const waifusApproved = useSelector(selectWaifusApproved);
  const globals = useSelector(selectGlobalsData);
  const isEth = useSelector(selectIsEth);

  const initContractHelper = async () => {
    contractHelper = new ContractHelper();
    await contractHelper.init();
  };

  const updateApprovals = async () => {
    setApproving(true);
    const _wetApproved = await contractHelper.isWetApprovedForDungeon();
    dispatch(setWetApproved(_wetApproved));
    const _waifusApproved = await contractHelper.isDungeonApprovedForAll();
    dispatch(setWaifusApproved(_waifusApproved));
    setApproving(false);
  };

  useEffect(() => {
    initContractHelper().then(() => updateApprovals());
  }, []);

  const approve = async (tokenContract: Contract, approveAddress: string) => {
    tokenContract.methods
      .approve(approveAddress, new BN("9999999999999999999999999999"))
      .send()
      .on("transactionHash", (hash: any) => {
        setApproving(true);
      })
      .on("receipt", (receipt: any) => {
        updateApprovals().then(() => setApproving(false));
      })
      .on("error", (err: any) => {
        console.log(`Error: ${err}`);
        setApproving(false);
      });
  };

  const approveWet = async () => {
    const wetContract = await contractHelper.getWetContract();
    await approve(wetContract, globals.dungeonAddress);
  };

  const approveWaifus = async () => {
    const waifuContract = await contractHelper.getWaifuContract();
    await approve(waifuContract, globals.dungeonAddress);
  };

  const burn = async () => {
    setError("");
    let waifuIdList: number[] = [];
    try {
      const stripped = waifuIds.replace(/\s/g, "");
      const split = stripped.split(",");
      waifuIdList = split.map((s: string) => Number(s));
    } catch {
      setError(t("errors.valid"));
      return;
    }
    for (let i = 0; i < waifuIdList.length; i++) {
      if (!Number.isInteger(waifuIdList[i])) {
        setError(t("errors.whole"));
        return;
      }
    }

    const dungeonContract = await contractHelper.getDungeonContract();
    dungeonContract.methods
      .commitSwapWaifus(waifuIdList)
      .send()
      .on("transactionHash", (hash: any) => {
        setCommited(true);
      })
      .on("receipt", (receipt: any) => {
        setCommitComplete(true);
      })
      .on("error", (err: any) => {
        console.log("error: ", err.message);
        setCommited(false);
      });
  };

  return (
    <>
      <Popup
        show={isEth && !isWaifuBurn && !isNftxBurn}
        close={() => props.close()}
        header={t("dungeon.headers.burnMethod")}
        body={t("dungeon.bodys.burnMethod")}
        buttonText={t("buttons.waifuNft")}
        buttonAction={() => setIsWaifuBurn(true)}
        secondButtonText={t("buttons.nftxWaifu")}
        secondButtonAction={() => setIsNftxBurn(true)}
      />
      <Popup
        show={props.show && !committed && (!isEth || isWaifuBurn || isNftxBurn)}
        close={() => props.close()}
        content={
          <Content>
            <Input
              value={waifuIds}
              placeholder="e.g. 1423, 121, 1102"
              onChange={(event) => setWaifuIds(event.target.value)}
            />
            {error && <Error>{error}</Error>}
          </Content>
        }
        header={t("dungeon.headers.burn")}
        body={t("dungeon.bodys.burn")}
        buttonAction={() => {
          if (!wetApproved) approveWet();
          else if (!waifusApproved) approveWaifus();
          else burn();
        }}
        buttonText={
          approving
            ? t("loading")
            : !wetApproved
            ? t("buttons.approveWet")
            : !waifusApproved
            ? t("buttons.approveWaifus")
            : t("buttons.burnWaifu")
        }
      />
      <LoadingPurchase
        show={committed}
        close={() => props.close()}
        loading={!commitComplete}
      />
    </>
  );
};

export default BurnWaifu;

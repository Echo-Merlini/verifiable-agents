import { Recorded } from "../generated/TruthAnchor/TruthAnchor";
import { Anchor } from "../generated/schema";

// Each OCP Recorded(digest, committer) becomes a queryable Anchor. We key by
// txHash-logIndex (never the digest — the same digest could be anchored twice)
// and index `digest` as a field so /verify can query anchors(where:{digest:...}).
export function handleRecorded(event: Recorded): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32());
  const a = new Anchor(id);
  a.digest = event.params.digest;
  a.committer = event.params.committer;
  a.blockNumber = event.block.number;
  a.blockTimestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.save();
}

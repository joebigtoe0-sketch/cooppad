// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Hook the launchpad calls on its launch tokens when the curve completes —
/// lifts the pre-graduation transfer lock. The token is a plain ERC20 afterwards.
interface ICoopLaunchToken {
    function graduate() external;
}

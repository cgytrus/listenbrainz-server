/* eslint-disable jsx-a11y/anchor-is-valid,camelcase,react/jsx-no-bind */

import * as React from "react";

import { faLink, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { useLoaderData } from "react-router-dom";
import { toast } from "react-toastify";
import { Helmet } from "react-helmet";

import NiceModal from "@ebay/nice-modal-react";

import { groupBy, pick, size, sortBy } from "lodash";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import BrainzPlayer from "../../common/brainzplayer/BrainzPlayer";
import Loader from "../../components/Loader";
import ListenCard from "../../common/listens/ListenCard";
import ListenControl from "../../common/listens/ListenControl";
import MBIDMappingModal from "../../common/listens/MBIDMappingModal";
import { ToastMsg } from "../../notifications/Notifications";
import GlobalAppContext from "../../utils/GlobalAppContext";
import {
  getArtistName,
  getRecordingMSID,
  getTrackName,
} from "../../utils/utils";
import MultiTrackMBIDMappingModal from "./MultiTrackMBIDMappingModal";
import Accordion from "../../common/Accordion";

export type MissingMBDataProps = {
  missingData?: Array<MissingMBData>;
  user: ListenBrainzUser;
};

type MissingMBDataLoaderData = {
  missing_data?: Array<MissingMBData>;
};

export interface MissingMBDataState {
  missingData: Array<MissingMBData>;
  groupedMissingData: Array<MissingMBData[]>;
  deletedListens: Array<string>; // array of recording_msid of deleted items
  currPage: number;
  totalPages: number;
  loading: boolean;
}

export function missingDataToListen(
  data: MissingMBData,
  user: ListenBrainzUser
): Listen {
  return {
    listened_at: new Date(data.listened_at).getTime() / 1000,
    user_name: user.name,
    track_metadata: {
      artist_name: data.artist_name,
      track_name: data.recording_name,
      release_name: data?.release_name ?? undefined,
      additional_info: {
        recording_msid: data.recording_msid,
      },
    },
  };
}

export default class MissingMBDataPage extends React.Component<
  MissingMBDataProps,
  MissingMBDataState
> {
  static contextType = GlobalAppContext;
  declare context: React.ContextType<typeof GlobalAppContext>;
  private expectedDataPerPage = 25;
  private MissingMBDataTable = React.createRef<HTMLTableElement>();

  constructor(props: MissingMBDataProps) {
    super(props);
    const groupedMissingData = groupBy(props.missingData, "release_name");
    // remove and store a catchall group with no release name
    const noRelease = pick(groupedMissingData, "null");
    if (size(noRelease) > 0) {
      // remove catchall group from other groups
      delete groupedMissingData.null;
    }
    const sortedMissingDataGroups = sortBy(
      groupedMissingData,
      "length"
    ).reverse();

    if (noRelease.null?.length) {
      // re-add the group with no release name at the end
      sortedMissingDataGroups.push(noRelease.null);
    }
    this.state = {
      missingData: props.missingData || [], // ?.slice(0, this.expectedDataPerPage) || [],
      groupedMissingData: sortedMissingDataGroups,
      currPage: 1,
      totalPages: groupedMissingData
        ? Math.ceil(size(groupedMissingData) / this.expectedDataPerPage)
        : 0,
      loading: false,
      deletedListens: [],
    };

    this.MissingMBDataTable = React.createRef();
  }

  componentDidMount(): void {
    const { currPage } = this.state;
    window.history.replaceState(null, "", `?page=${currPage}`);
  }

  handleClickPrevious = () => {
    const { currPage } = this.state;
    if (currPage && currPage > 1) {
      this.setState({ loading: true });
      const updatedPage = currPage - 1;
      this.setState(
        {
          currPage: updatedPage,
        },
        this.afterDisplay
      );
      window.history.pushState(null, "", `?page=${updatedPage}`);
    }
  };

  handleClickNext = () => {
    const { currPage, totalPages } = this.state;
    if (currPage && currPage < totalPages) {
      this.setState({ loading: true });
      const updatedPage = currPage + 1;
      this.setState(
        {
          currPage: updatedPage,
        },
        this.afterDisplay
      );
      window.history.pushState(null, "", `?page=${updatedPage}`);
    }
  };

  afterDisplay = () => {
    if (this.MissingMBDataTable?.current) {
      this.MissingMBDataTable.current.scrollIntoView({ behavior: "smooth" });
    }
    this.setState({ loading: false });
  };

  submitMissingData = (listen: Listen) => {
    // This function submits data to the MusicBrainz server. We have not used
    // fetch here because the endpoint where the submision is being done
    // replies back with HTML and since we cannot redirect via fetch, we have
    // to resort to such obscure method :D
    const { user } = this.props;
    const form = document.createElement("form");
    form.method = "post";
    form.action = "https://musicbrainz.org/release/add";
    form.target = "_blank";
    const name = document.createElement("input");
    name.type = "hidden";
    name.name = "name";
    name.value = listen.track_metadata?.release_name || "";
    form.appendChild(name);
    const recording = document.createElement("input");
    recording.type = "hidden";
    recording.name = "mediums.0.track.0.name";
    recording.value = getTrackName(listen);
    form.appendChild(recording);
    const artists = getArtistName(listen).split(",");
    artists.forEach((artist, index) => {
      const artistCredit = document.createElement("input");
      artistCredit.type = "hidden";
      artistCredit.name = `artist_credit.names.${index}.artist.name`;
      artistCredit.value = artist;
      form.appendChild(artistCredit);
      if (index !== artists.length - 1) {
        const joiner = document.createElement("input");
        joiner.type = "hidden";
        joiner.name = `artist_credit.names.${index}.join_phrase`;
        joiner.value = ", ";
        form.appendChild(joiner);
      }
    });
    const editNote = document.createElement("textarea");
    editNote.style.display = "none";
    editNote.name = "edit_note";
    editNote.value = `Imported from ${user.name}'s ListenBrainz Missing MusicBrainz Data Page`;
    form.appendChild(editNote);
    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  deleteListen = async (data: MissingMBData) => {
    const { user } = this.props;
    const { APIService, currentUser } = this.context;
    const isCurrentUser = user.name === currentUser?.name;
    if (isCurrentUser && currentUser?.auth_token) {
      const listenedAt = new Date(data.listened_at).getTime() / 1000;
      try {
        const status = await APIService.deleteListen(
          currentUser.auth_token,
          data.recording_msid,
          listenedAt
        );
        if (status === 200) {
          this.setState((prevState) => ({
            deletedListens: prevState.deletedListens.concat(
              data.recording_msid
            ),
          }));
          toast.info(
            <ToastMsg
              title="Success"
              message={
                "This listen has not been deleted yet, but is scheduled for deletion," +
                " which usually happens shortly after the hour."
              }
            />,
            { toastId: "deleted-track" }
          );
        }
      } catch (error) {
        toast.error(
          <ToastMsg
            title="Error while deleting listen"
            message={
              typeof error === "object" ? error.message : error.toString()
            }
          />,
          { toastId: "deleted-track-error" }
        );
      }
    }
  };

  render() {
    const {
      missingData,
      groupedMissingData,
      currPage,
      totalPages,
      loading,
      deletedListens,
    } = this.state;
    const { user } = this.props;
    const { APIService, currentUser } = this.context;
    const isCurrentUser = user.name === currentUser?.name;

    const offset = (currPage - 1) * this.expectedDataPerPage;
    const itemsOnThisPage = groupedMissingData.slice(
      offset,
      offset + this.expectedDataPerPage
    );
    return (
      <>
        <Helmet>
          <title>Missing MusicBrainz Data of {currentUser?.name}</title>
        </Helmet>
        <h2 className="page-title">
          Missing MusicBrainz Data of {currentUser?.name}
        </h2>
        <p>
          <a href="https://musicbrainz.org/">MusicBrainz</a> is the open-source
          music encyclopedia that ListenBrainz uses to display information about
          your music.
          <br />
          <br />
          This page shows your top 200 submitted tracks that we haven&apos;t
          been able to automatically link with MusicBrainz, or that don&apos;t
          yet exist in MusicBrainz. Please take a few minutes to link these
          recordings below, or to{" "}
          <a href="https://wiki.musicbrainz.org/How_to_Contribute">
            submit new data to MusicBrainz
          </a>
          .
        </p>
        <p>
          Tracks are grouped by album (according to the available data) to allow
          linking multiple listens from the same album in one go, but you can
          still map each one separately if you wish.
          <br />
          Listens with no album information are shown at the very end of the
          list.
        </p>
        <div>
          <div>
            <div id="missingMBData" ref={this.MissingMBDataTable}>
              <div
                style={{
                  height: 0,
                  position: "sticky",
                  top: "50%",
                  zIndex: 1,
                }}
              >
                <Loader isLoading={loading} />
              </div>
              {itemsOnThisPage.map((group) => {
                const releaseName = group.at(0)?.release_name ?? null;
                const multiTrackMappingButton = (
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ padding: "5px" }}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      NiceModal.show(MultiTrackMBIDMappingModal, {
                        missingData: group,
                        releaseName,
                      });
                    }}
                    data-toggle="modal"
                    data-target="#MultiTrackMBIDMappingModal"
                  >
                    <FontAwesomeIcon icon={faLink} /> x {group.length}
                  </button>
                );
                const listenCards = group.map((groupItem) => {
                  if (
                    deletedListens.find(
                      (deletedMSID) => deletedMSID === groupItem.recording_msid
                    )
                  ) {
                    // If the item was deleted, don't show it to the user
                    return undefined;
                  }
                  let additionalActions;
                  const listen = missingDataToListen(groupItem, user);
                  const additionalMenuItems = [];
                  if (currentUser?.auth_token) {
                    const recordingMSID = getRecordingMSID(listen);
                    const canDelete =
                      isCurrentUser &&
                      Boolean(listen.listened_at) &&
                      Boolean(recordingMSID);

                    if (canDelete) {
                      additionalMenuItems.push(
                        <ListenControl
                          text="Delete Listen"
                          icon={faTrashAlt}
                          action={this.deleteListen.bind(this, groupItem)}
                        />
                      );
                    }

                    if (
                      listen?.track_metadata?.additional_info?.recording_msid
                    ) {
                      const linkWithMB = (
                        <ListenControl
                          buttonClassName="btn btn-link color-orange"
                          text=""
                          title="Link with MusicBrainz"
                          icon={faLink}
                          action={() => {
                            NiceModal.show(MBIDMappingModal, {
                              listenToMap: listen,
                            });
                          }}
                        />
                      );
                      additionalActions = linkWithMB;
                    }
                  }
                  return (
                    <ListenCard
                      key={`${groupItem.recording_name}-${groupItem.artist_name}-${groupItem.listened_at}`}
                      showTimestamp
                      showUsername={false}
                      // eslint-disable-next-line react/jsx-no-useless-fragment
                      customThumbnail={<></>}
                      // eslint-disable-next-line react/jsx-no-useless-fragment
                      feedbackComponent={<></>}
                      listen={listen}
                      additionalMenuItems={additionalMenuItems}
                      additionalActions={additionalActions}
                    />
                  );
                });
                if (!releaseName?.length) {
                  // If this is the group with no release name, return listencards
                  // directly instead of an accordion group
                  return <div>{listenCards}</div>;
                }
                return (
                  <Accordion
                    title={
                      <>
                        {multiTrackMappingButton} {releaseName}
                      </>
                    }
                  >
                    {listenCards}
                  </Accordion>
                );
              })}
            </div>
            <ul className="pager" style={{ display: "flex" }}>
              <li
                className={`previous ${
                  currPage && currPage <= 1 ? "hidden" : ""
                }`}
              >
                <a
                  role="button"
                  onClick={this.handleClickPrevious}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") this.handleClickPrevious();
                  }}
                  tabIndex={0}
                >
                  &larr; Previous
                </a>
              </li>
              <li
                className={`next ${
                  currPage && currPage >= totalPages ? "hidden" : ""
                }`}
                style={{ marginLeft: "auto" }}
              >
                <a
                  role="button"
                  onClick={this.handleClickNext}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") this.handleClickNext();
                  }}
                  tabIndex={0}
                >
                  Next &rarr;
                </a>
              </li>
            </ul>
          </div>
        </div>
        <BrainzPlayer
          listens={missingData.map((datum) => missingDataToListen(datum, user))}
          listenBrainzAPIBaseURI={APIService.APIBaseURI}
          refreshSpotifyToken={APIService.refreshSpotifyToken}
          refreshYoutubeToken={APIService.refreshYoutubeToken}
          refreshSoundcloudToken={APIService.refreshSoundcloudToken}
        />
      </>
    );
  }
}

export function MissingMBDataPageWrapper() {
  const data = useLoaderData() as MissingMBDataLoaderData;
  const { currentUser: user } = React.useContext(GlobalAppContext);
  return <MissingMBDataPage missingData={data.missing_data} user={user} />;
}
